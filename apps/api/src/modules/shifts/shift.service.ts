import { ShiftStatus } from '@prisma/client'
import { prisma } from '../../infrastructure/db/prisma'
import { notificationService } from '../notifications/notification.service'

export const shiftService = {
  async create(orgId: string, data: {
    courierId:      string
    zoneId?:        string
    warehouseId?:   string
    scheduledStart: Date
    scheduledEnd:   Date
  }) {
    // Проверяем пересечение смен у курьера
    const overlap = await prisma.shift.findFirst({
      where: {
        courierId: data.courierId,
        status:    { in: [ShiftStatus.SCHEDULED, ShiftStatus.ACTIVE] },
        OR: [
          { scheduledStart: { lte: data.scheduledEnd }, scheduledEnd: { gte: data.scheduledStart } },
        ],
      },
    })
    if (overlap) throw Object.assign(new Error('Shift overlap: courier already has a shift in this time range'), { status: 409 })

    return prisma.shift.create({
      data: { organizationId: orgId, ...data },
      include: { courier: { include: { user: { select: { name: true } } } }, zone: true, warehouse: true },
    })
  },

  async list(orgId: string, filters: { courierId?: string; date?: Date; status?: ShiftStatus }) {
    const { courierId, date, status } = filters
    let dateFilter = {}
    if (date) {
      const start = new Date(date); start.setHours(0, 0, 0, 0)
      const end   = new Date(date); end.setHours(23, 59, 59, 999)
      dateFilter  = { scheduledStart: { gte: start, lte: end } }
    }
    return prisma.shift.findMany({
      where: {
        organizationId: orgId,
        ...(courierId ? { courierId } : {}),
        ...(status    ? { status }    : {}),
        ...dateFilter,
      },
      include: {
        courier:   { include: { user: { select: { name: true } } } },
        zone:      { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true } },
      },
      orderBy: { scheduledStart: 'asc' },
    })
  },

  async get(id: string, orgId: string) {
    const shift = await prisma.shift.findFirst({
      where:   { id, organizationId: orgId },
      include: { courier: { include: { user: { select: { name: true } } } }, zone: true, warehouse: true },
    })
    if (!shift) throw Object.assign(new Error('Shift not found'), { status: 404 })
    return shift
  },

  // Курьер открывает смену (check-in)
  async startShift(shiftId: string, courierId: string) {
    const shift = await prisma.shift.findFirst({
      where: { id: shiftId, courierId, status: ShiftStatus.SCHEDULED },
    })
    if (!shift) throw Object.assign(new Error('Shift not found or already started'), { status: 404 })

    const now = new Date()
    // Не раньше чем за 15 минут до начала
    const earlyMs = shift.scheduledStart.getTime() - now.getTime()
    if (earlyMs > 15 * 60_000) throw Object.assign(new Error('Too early to start shift'), { status: 409 })

    const updated = await prisma.shift.update({
      where: { id: shiftId },
      data:  { status: ShiftStatus.ACTIVE, actualStart: now },
    })

    // Помечаем курьера онлайн
    await prisma.courier.update({ where: { id: courierId }, data: { isOnline: true, lastSeenAt: now } })

    // Push подтверждение курьеру
    await notificationService.pushToCourier(courierId, 'Смена начата', `Смена до ${shift.scheduledEnd.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}`)

    return updated
  },

  // Курьер закрывает смену (check-out)
  async endShift(shiftId: string, courierId: string) {
    const shift = await prisma.shift.findFirst({
      where: { id: shiftId, courierId, status: ShiftStatus.ACTIVE },
    })
    if (!shift) throw Object.assign(new Error('Active shift not found'), { status: 404 })

    // Нельзя закрыть если есть активные заказы
    const activeOrders = await prisma.order.count({
      where: { courierId, status: { in: ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] } },
    })
    if (activeOrders > 0) throw Object.assign(new Error(`Cannot end shift: ${activeOrders} active order(s) remaining`), { status: 409 })

    const now     = new Date()
    const updated = await prisma.shift.update({
      where: { id: shiftId },
      data:  { status: ShiftStatus.COMPLETED, actualEnd: now },
    })

    await prisma.courier.update({ where: { id: courierId }, data: { isOnline: false } })

    return updated
  },

  async cancel(shiftId: string, orgId: string) {
    const shift = await prisma.shift.findFirst({
      where: { id: shiftId, organizationId: orgId, status: { in: [ShiftStatus.SCHEDULED, ShiftStatus.ACTIVE] } },
    })
    if (!shift) throw Object.assign(new Error('Shift not found or already completed'), { status: 404 })

    return prisma.shift.update({ where: { id: shiftId }, data: { status: ShiftStatus.CANCELLED } })
  },

  // Активные смены прямо сейчас (для супервизора)
  async getActiveNow(orgId: string) {
    const now = new Date()
    return prisma.shift.findMany({
      where: {
        organizationId: orgId,
        status:         ShiftStatus.ACTIVE,
        scheduledStart: { lte: now },
        scheduledEnd:   { gte: now },
      },
      include: {
        courier: {
          select: { id: true, isOnline: true, currentLat: true, currentLon: true, user: { select: { name: true } } },
        },
        zone:    { select: { id: true, name: true } },
      },
      orderBy: { scheduledStart: 'asc' },
    })
  },

  // Обновить зону/склад смены
  async update(id: string, orgId: string, data: Partial<{ zoneId: string; warehouseId: string; scheduledStart: Date; scheduledEnd: Date }>) {
    const shift = await prisma.shift.findFirst({ where: { id, organizationId: orgId, status: ShiftStatus.SCHEDULED } })
    if (!shift) throw Object.assign(new Error('Shift not found or not editable'), { status: 404 })
    return prisma.shift.update({ where: { id }, data })
  },
}
