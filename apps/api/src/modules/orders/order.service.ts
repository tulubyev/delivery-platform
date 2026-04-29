import { OrderStatus, DispatchMode, Prisma } from '@prisma/client'
import { prisma } from '../../infrastructure/db/prisma'
import { AppError } from '../../middleware/error.middleware'
import { encryptionService } from '../../infrastructure/encryption/encryption.service'
import { CreateOrderDto, UpdateOrderStatusDto, OrderFiltersDto } from '@delivery/shared'
import { redis } from '../../infrastructure/redis/redis'

// ── Статусная машина ──────────────────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  CREATED:    ['ASSIGNED', 'CANCELLED'],
  ASSIGNED:   ['PICKED_UP', 'CANCELLED'],
  PICKED_UP:  ['IN_TRANSIT'],
  IN_TRANSIT: ['DELIVERED', 'FAILED'],
  DELIVERED:  [],
  FAILED:     ['IN_TRANSIT', 'RETURNING'],
  CANCELLED:  [],
  RETURNING:  [],
}

function assertTransition(from: OrderStatus, to: OrderStatus) {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new AppError(409, `Переход ${from} → ${to} недопустим`)
  }
}

// ── Генерация номера заказа ───────────────────────────────────────────────────

async function generateNumber(orgId: string): Promise<string> {
  const date   = new Date()
  const prefix = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
  const count  = await prisma.order.count({ where: { organizationId: orgId } })
  return `${prefix}-${String(count + 1).padStart(5, '0')}`
}

// ── Шифрование PII ────────────────────────────────────────────────────────────

function encryptOrderPii(dto: { recipientName: string; recipientPhone: string; deliveryAddress: object }) {
  const config = { encryptionEnabled: true } // в будущем читается из TenantConfig
  if (!config.encryptionEnabled || !process.env.ENCRYPTION_KEY) {
    return {
      recipientNameEnc:  dto.recipientName,
      recipientPhoneEnc: dto.recipientPhone,
      deliveryAddress:   dto.deliveryAddress as Prisma.InputJsonValue,
    }
  }
  return {
    recipientNameEnc:  encryptionService.encrypt(dto.recipientName),
    recipientPhoneEnc: encryptionService.encrypt(dto.recipientPhone),
    deliveryAddress:   encryptionService.encrypt(JSON.stringify(dto.deliveryAddress)) as unknown as Prisma.InputJsonValue,
  }
}

function decryptOrderPii(order: { recipientNameEnc: string; recipientPhoneEnc: string; deliveryAddress: Prisma.JsonValue }) {
  if (!process.env.ENCRYPTION_KEY) {
    return { recipientName: order.recipientNameEnc, recipientPhone: order.recipientPhoneEnc, deliveryAddress: order.deliveryAddress }
  }
  try {
    return {
      recipientName:   encryptionService.decrypt(order.recipientNameEnc),
      recipientPhone:  encryptionService.decrypt(order.recipientPhoneEnc),
      deliveryAddress: JSON.parse(encryptionService.decrypt(order.deliveryAddress as string)),
    }
  } catch {
    // если ENCRYPTION_KEY не был задан при записи — возвращаем as-is
    return { recipientName: order.recipientNameEnc, recipientPhone: order.recipientPhoneEnc, deliveryAddress: order.deliveryAddress }
  }
}

// ── Сервис ────────────────────────────────────────────────────────────────────

export const orderService = {
  async create(orgId: string, dto: CreateOrderDto) {
    // Проверяем что клиент принадлежит организации
    const client = await prisma.client.findFirst({ where: { id: dto.clientId, organizationId: orgId } })
    if (!client) throw new AppError(404, 'Клиент не найден в организации')

    const config = await prisma.tenantConfig.findUnique({ where: { organizationId: orgId } })
    const slaMinutes = config?.slaMinutes ?? 60

    const { recipientNameEnc, recipientPhoneEnc, deliveryAddress } = encryptOrderPii({
      recipientName:   dto.recipientName,
      recipientPhone:  dto.recipientPhone,
      deliveryAddress: dto.deliveryAddress,
    })

    const number       = await generateNumber(orgId)
    const slaDeadlineAt = new Date(Date.now() + slaMinutes * 60_000)
    const dispatchMode  = (dto.dispatchMode as DispatchMode) ?? config?.dispatchMode ?? DispatchMode.AUTO

    const order = await prisma.order.create({
      data: {
        organizationId:    orgId,
        number,
        clientId:          dto.clientId,
        warehouseId:       dto.warehouseId,
        pickupPointId:     dto.pickupPointId,
        dispatchMode,
        pickupAddress:     dto.pickupAddress as Prisma.InputJsonValue,
        deliveryAddress,
        recipientNameEnc,
        recipientPhoneEnc,
        weight:            dto.weight,
        dimensionsJson:    dto.dimensions as Prisma.InputJsonValue | undefined,
        declaredValue:     dto.declaredValue,
        paymentOnDelivery: dto.paymentOnDelivery,
        scheduledAt:       dto.scheduledAt,
        slaDeadlineAt,
        notes:             dto.notes,
        externalId:        dto.externalId,
        // TrackingToken — живёт 24ч
        trackingTokens: {
          create: { expiresAt: new Date(Date.now() + 24 * 60 * 60_000) },
        },
      },
      include: { trackingTokens: true },
    })

    await prisma.orderStatusEvent.create({
      data: { orderId: order.id, status: OrderStatus.CREATED },
    })

    return this._withDecryptedPii(order)
  },

  async getById(id: string, orgId: string) {
    const order = await prisma.order.findFirst({
      where: { id, organizationId: orgId },
      include: {
        statusHistory:     { orderBy: { createdAt: 'asc' } },
        courier:           { include: { user: { select: { name: true, phone: true } } } },
        client:            { select: { companyName: true } },
        zone:              { select: { name: true } },
        trackingTokens:    { select: { token: true, expiresAt: true } },
        dispatchOffers:    { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    })
    if (!order) throw new AppError(404, 'Заказ не найден')
    return this._withDecryptedPii(order)
  },

  async list(orgId: string, filters: OrderFiltersDto) {
    const { status, courierId, clientId, zoneId, dateFrom, dateTo, page, limit } = filters
    const where: Prisma.OrderWhereInput = {
      organizationId: orgId,
      ...(status    && { status }),
      ...(courierId && { courierId }),
      ...(clientId  && { clientId }),
      ...(zoneId    && { zoneId }),
      ...(dateFrom || dateTo ? {
        createdAt: {
          ...(dateFrom && { gte: dateFrom }),
          ...(dateTo   && { lte: dateTo }),
        },
      } : {}),
    }

    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
        include: {
          courier: { include: { user: { select: { name: true } } } },
          client:  { select: { companyName: true } },
          zone:    { select: { name: true } },
        },
      }),
      prisma.order.count({ where }),
    ])

    return { items: items.map(o => this._withDecryptedPii(o)), total, page, limit }
  },

  async updateStatus(id: string, orgId: string, dto: UpdateOrderStatusDto, actorId: string) {
    const order = await prisma.order.findFirst({ where: { id, organizationId: orgId } })
    if (!order) throw new AppError(404, 'Заказ не найден')

    const nextStatus = dto.status as OrderStatus
    assertTransition(order.status, nextStatus)

    // DELIVERED требует фото или подпись
    if (nextStatus === OrderStatus.DELIVERED && !dto.photoUrl && !dto.signatureUrl) {
      throw new AppError(422, 'Для подтверждения доставки необходимо фото или подпись')
    }

    const now = new Date()
    const updateData: Prisma.OrderUpdateInput = { status: nextStatus }

    if (nextStatus === OrderStatus.PICKED_UP)  updateData.pickedUpAt   = now
    if (nextStatus === OrderStatus.DELIVERED) {
      updateData.deliveredAt      = now
      updateData.photoUrl         = dto.photoUrl
      updateData.signatureUrl     = dto.signatureUrl
      updateData.recipientSigned  = !!dto.signatureUrl
    }

    const [updated] = await prisma.$transaction([
      prisma.order.update({ where: { id }, data: updateData }),
      prisma.orderStatusEvent.create({
        data: {
          orderId:   id,
          status:    nextStatus,
          comment:   dto.comment,
          lat:       dto.lat,
          lon:       dto.lon,
          createdBy: actorId,
        },
      }),
      // Обновляем счётчик курьера при доставке
      ...(nextStatus === OrderStatus.DELIVERED && order.courierId
        ? [prisma.courier.update({ where: { id: order.courierId }, data: { totalOrders: { increment: 1 } } })]
        : []),
    ])

    return this._withDecryptedPii(updated)
  },

  async assign(id: string, orgId: string, courierId: string, actorId: string) {
    // Находим заказ — если orgId не задан (ADMIN без орг), ищем только по id
    const orderWhere = orgId ? { id, organizationId: orgId } : { id }
    const order = await prisma.order.findFirst({ where: orderWhere })
    if (!order) throw new AppError(404, 'Заказ не найден')
    assertTransition(order.status, OrderStatus.ASSIGNED)

    // Находим курьера без требования verifiedAt
    const courierWhere = orgId ? { id: courierId, organizationId: orgId } : { id: courierId }
    const courier = await prisma.courier.findFirst({ where: courierWhere })
    if (!courier) throw new AppError(404, 'Курьер не найден')

    const [updated] = await prisma.$transaction([
      prisma.order.update({ where: { id }, data: { courierId, status: OrderStatus.ASSIGNED } }),
      prisma.orderStatusEvent.create({
        data: { orderId: id, status: OrderStatus.ASSIGNED, createdBy: actorId },
      }),
    ])

    // Публикуем событие в WS-канал организации для супервизора
    const notifyOrgId = order.organizationId
    if (notifyOrgId) {
      await redis.publish(`org:${notifyOrgId}`, JSON.stringify({
        type: 'ORDER_ASSIGNED',
        payload: { orderId: id, courierId, orderNumber: order.number },
      }))
    }

    return this._withDecryptedPii(updated)
  },

  async update(id: string, orgId: string, dto: {
    notes?: string
    weight?: number
    declaredValue?: number
    paymentOnDelivery?: boolean
    scheduledAt?: string
    recipientName?: string
    recipientPhone?: string
    pickupAddress?: object
    deliveryAddress?: object
  }) {
    const order = await prisma.order.findFirst({ where: { id, organizationId: orgId } })
    if (!order) throw new AppError(404, 'Заказ не найден')

    const updateData: Prisma.OrderUpdateInput = {
      ...(dto.notes          !== undefined && { notes: dto.notes }),
      ...(dto.weight         !== undefined && { weight: dto.weight }),
      ...(dto.declaredValue  !== undefined && { declaredValue: dto.declaredValue }),
      ...(dto.paymentOnDelivery !== undefined && { paymentOnDelivery: dto.paymentOnDelivery }),
      ...(dto.scheduledAt    !== undefined && { scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null }),
    }

    // Зашифруем PII если меняются
    if (dto.recipientName || dto.recipientPhone || dto.deliveryAddress) {
      const pii = encryptOrderPii({
        recipientName:   dto.recipientName   ?? order.recipientNameEnc,
        recipientPhone:  dto.recipientPhone  ?? order.recipientPhoneEnc,
        deliveryAddress: dto.deliveryAddress ?? (order.deliveryAddress as object),
      })
      updateData.recipientNameEnc  = pii.recipientNameEnc
      updateData.recipientPhoneEnc = pii.recipientPhoneEnc
      updateData.deliveryAddress   = pii.deliveryAddress
    }
    if (dto.pickupAddress) {
      updateData.pickupAddress = dto.pickupAddress as Prisma.InputJsonValue
    }

    const updated = await prisma.order.update({ where: { id }, data: updateData })
    return this._withDecryptedPii(updated)
  },

  async cancel(id: string, orgId: string, actorId: string, comment?: string) {
    const order = await prisma.order.findFirst({ where: { id, organizationId: orgId } })
    if (!order) throw new AppError(404, 'Заказ не найден')
    assertTransition(order.status, OrderStatus.CANCELLED)

    const [updated] = await prisma.$transaction([
      prisma.order.update({ where: { id }, data: { status: OrderStatus.CANCELLED } }),
      prisma.orderStatusEvent.create({
        data: { orderId: id, status: OrderStatus.CANCELLED, comment, createdBy: actorId },
      }),
    ])

    return this._withDecryptedPii(updated)
  },

  // ── Внутренний хелпер: расшифровка PII перед отдачей клиенту ───────────────
  _withDecryptedPii<T extends { recipientNameEnc: string; recipientPhoneEnc: string; deliveryAddress: Prisma.JsonValue }>(
    order: T,
  ) {
    const pii = decryptOrderPii(order)
    return { ...order, ...pii }
  },
}
