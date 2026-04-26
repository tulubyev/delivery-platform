import { DispatchMode, OfferStatus, OrderStatus, AlertType, AlertSeverity } from '@prisma/client'
import { prisma } from '../../infrastructure/db/prisma'
import { redis } from '../../infrastructure/redis/redis'
import { dispatchQueue, dispatchOfferQueue } from '../../infrastructure/queue/queues'
import { haversineKm } from '../zones/zone.service'

// Redis ключи
const poolKey  = (orgId: string, zoneId: string) => `dispatch:pool:${orgId}:${zoneId}`
const lockKey  = (orderId: string)                => `dispatch:lock:${orderId}`
const LOCK_TTL = 10 // секунд — атомарный lock на назначение

// ── Авто-диспетчинг ───────────────────────────────────────────────────────────

async function autoDispatch(orderId: string, orgId: string, attempt: number): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { zone: true },
  })
  if (!order || order.status !== OrderStatus.CREATED) return false

  const config = await prisma.tenantConfig.findUnique({ where: { organizationId: orgId } })
  const radiusKm = config?.autoDispatchRadiusKm ?? 5

  // Достаём пикап-координаты из адреса
  const pickup = order.pickupAddress as { lat?: number; lon?: number }

  // Ищем подходящих курьеров
  const candidates = await prisma.courier.findMany({
    where: {
      organizationId: orgId,
      isOnline:       true,
      verifiedAt:     { not: null },
      currentLat:     { not: null },
      currentLon:     { not: null },
      // не более 5 активных заказов одновременно
      orders: { none: { status: { in: [OrderStatus.ASSIGNED, OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT] } } },
    },
  })

  // Фильтр по радиусу + сортировка по расстоянию
  const sorted = candidates
    .filter(c => {
      if (!pickup.lat || !pickup.lon || !c.currentLat || !c.currentLon) return false
      return haversineKm(c.currentLat, c.currentLon, pickup.lat, pickup.lon) <= radiusKm
    })
    .sort((a, b) => {
      const da = haversineKm(a.currentLat!, a.currentLon!, pickup.lat!, pickup.lon!)
      const db = haversineKm(b.currentLat!, b.currentLon!, pickup.lat!, pickup.lon!)
      return da - db
    })

  if (sorted.length === 0) {
    // Не нашли — планируем повтор или создаём алерт
    if (attempt < 3) {
      await dispatchQueue.add(
        'retry',
        { orderId, organizationId: orgId, attempt: attempt + 1 },
        { delay: 30_000 },
      )
    } else {
      await prisma.alert.create({
        data: {
          organizationId: orgId,
          type:           AlertType.DISPATCH_FAILED,
          severity:       AlertSeverity.HIGH,
          entityType:     'Order',
          entityId:       orderId,
          message:        `Заказ ${order.number} не удалось назначить курьеру после 3 попыток`,
        },
      })
    }
    return false
  }

  // Атомарный lock — защита от race condition
  const locked = await redis.set(lockKey(orderId), '1', 'EX', LOCK_TTL, 'NX')
  if (!locked) return false // другой воркер уже взял

  try {
    const courier = sorted[0]
    await prisma.$transaction([
      prisma.order.update({
        where: { id: orderId },
        data:  { courierId: courier.id, status: OrderStatus.ASSIGNED },
      }),
      prisma.orderStatusEvent.create({
        data: { orderId, status: OrderStatus.ASSIGNED, createdBy: 'auto-dispatch' },
      }),
    ])
    return true
  } finally {
    await redis.del(lockKey(orderId))
  }
}

// ── Конкурентный диспетчинг ───────────────────────────────────────────────────

async function competitiveDispatch(orderId: string, orgId: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order || order.status !== OrderStatus.CREATED) return

  const config = await prisma.tenantConfig.findUnique({ where: { organizationId: orgId } })
  const timeoutSec = config?.competitiveOfferTimeoutSec ?? 120

  // Публикуем заказ в Redis-пул зоны
  const zone = order.zoneId ?? 'default'
  await redis.sadd(poolKey(orgId, zone), orderId)

  // Находим онлайн-курьеров в зоне
  const couriers = await prisma.courier.findMany({
    where: {
      organizationId: orgId,
      isOnline:       true,
      verifiedAt:     { not: null },
    },
    select: { id: true },
  })

  if (couriers.length === 0) {
    // Нет доступных курьеров — сразу алерт
    await prisma.alert.create({
      data: {
        organizationId: orgId,
        type:           AlertType.DISPATCH_FAILED,
        severity:       AlertSeverity.HIGH,
        entityType:     'Order',
        entityId:       orderId,
        message:        `Заказ ${order.number}: нет онлайн-курьеров для конкурентного назначения`,
      },
    })
    return
  }

  // Создаём офферы и delayed job на истечение
  const expiresAt = new Date(Date.now() + timeoutSec * 1000)
  await Promise.all(
    couriers.map(async c => {
      const offer = await prisma.dispatchOffer.create({
        data: { orderId, courierId: c.id, expiresAt },
      })
      // Delayed job — истечёт через timeoutSec
      await dispatchOfferQueue.add(
        'expire',
        { offerId: offer.id, orderId, courierId: c.id },
        { delay: timeoutSec * 1000 },
      )
    }),
  )
}

// ── Принятие/отклонение оффера ────────────────────────────────────────────────

async function acceptOffer(offerId: string, courierId: string): Promise<boolean> {
  const offer = await prisma.dispatchOffer.findUnique({ where: { id: offerId } })
  if (!offer || offer.courierId !== courierId) return false
  if (offer.status !== OfferStatus.PENDING)    return false
  if (offer.expiresAt < new Date())             return false

  // Атомарный lock — только один курьер получает заказ
  const locked = await redis.set(lockKey(offer.orderId), courierId, 'EX', LOCK_TTL, 'NX')
  if (!locked) return false

  try {
    const order = await prisma.order.findUnique({ where: { id: offer.orderId } })
    if (!order || order.status !== OrderStatus.CREATED) return false

    await prisma.$transaction([
      prisma.order.update({
        where: { id: offer.orderId },
        data:  { courierId, status: OrderStatus.ASSIGNED },
      }),
      prisma.orderStatusEvent.create({
        data: { orderId: offer.orderId, status: OrderStatus.ASSIGNED, createdBy: courierId },
      }),
      // Принятый оффер
      prisma.dispatchOffer.update({
        where: { id: offerId },
        data:  { status: OfferStatus.ACCEPTED, respondedAt: new Date() },
      }),
      // Все остальные офферы по заказу — EXPIRED
      prisma.dispatchOffer.updateMany({
        where: { orderId: offer.orderId, id: { not: offerId }, status: OfferStatus.PENDING },
        data:  { status: OfferStatus.EXPIRED },
      }),
    ])

    // Убираем из Redis-пула
    const orgId = order.organizationId
    const zone  = order.zoneId ?? 'default'
    await redis.srem(poolKey(orgId, zone), offer.orderId)
    return true
  } finally {
    await redis.del(lockKey(offer.orderId))
  }
}

async function declineOffer(offerId: string, courierId: string): Promise<void> {
  await prisma.dispatchOffer.updateMany({
    where: { id: offerId, courierId, status: OfferStatus.PENDING },
    data:  { status: OfferStatus.DECLINED, respondedAt: new Date() },
  })
}

async function expireOffer(offerId: string): Promise<void> {
  await prisma.dispatchOffer.updateMany({
    where: { id: offerId, status: OfferStatus.PENDING },
    data:  { status: OfferStatus.EXPIRED },
  })

  // Если все офферы по заказу истекли — алерт супервизору
  const offer = await prisma.dispatchOffer.findUnique({
    where: { id: offerId },
    include: { order: { select: { number: true, organizationId: true, status: true } } },
  })
  if (!offer) return

  const stillPending = await prisma.dispatchOffer.count({
    where: { orderId: offer.orderId, status: OfferStatus.PENDING },
  })

  if (stillPending === 0 && offer.order.status === OrderStatus.CREATED) {
    await prisma.alert.create({
      data: {
        organizationId: offer.order.organizationId,
        type:           AlertType.DISPATCH_FAILED,
        severity:       AlertSeverity.HIGH,
        entityType:     'Order',
        entityId:       offer.orderId,
        message:        `Заказ ${offer.order.number}: ни один курьер не принял предложение`,
      },
    })
  }
}

// ── Точка входа — вызывается из Worker ───────────────────────────────────────

export const dispatchService = {
  // Главный диспетч — определяет режим и запускает нужный алгоритм
  async dispatch(orderId: string, orgId: string, attempt: number) {
    const order = await prisma.order.findUnique({ where: { id: orderId } })
    if (!order) return

    const mode = order.dispatchMode
    if (mode === DispatchMode.AUTO)        await autoDispatch(orderId, orgId, attempt)
    else if (mode === DispatchMode.COMPETITIVE) await competitiveDispatch(orderId, orgId)
    // MANUAL — ничего не делаем, ждёт супервизора
  },

  // Курьер принимает оффер (competitive)
  acceptOffer,
  declineOffer,
  expireOffer,

  // Получить доступные заказы из пула (для courier app)
  async getPoolOrders(orgId: string, zoneId: string) {
    const orderIds = await redis.smembers(poolKey(orgId, zoneId))
    if (orderIds.length === 0) return []
    return prisma.order.findMany({
      where:  { id: { in: orderIds }, status: OrderStatus.CREATED },
      select: { id: true, number: true, pickupAddress: true, deliveryAddress: true, zoneId: true, createdAt: true },
    })
  },
}
