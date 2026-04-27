import { prisma } from '../../infrastructure/db/prisma'

export const warehouseService = {
  async create(orgId: string, data: { name: string; address: object; lat: number; lon: number }) {
    return prisma.warehouse.create({
      data: { organizationId: orgId, ...data },
    })
  },

  async list(orgId: string, includeInactive = false) {
    return prisma.warehouse.findMany({
      where:   { organizationId: orgId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: { name: 'asc' },
    })
  },

  async get(id: string, orgId: string) {
    const w = await prisma.warehouse.findFirst({ where: { id, organizationId: orgId } })
    if (!w) throw Object.assign(new Error('Warehouse not found'), { status: 404 })
    return w
  },

  async update(id: string, orgId: string, data: Partial<{ name: string; address: object; lat: number; lon: number; isActive: boolean }>) {
    await this.get(id, orgId)
    return prisma.warehouse.update({ where: { id }, data })
  },

  async deactivate(id: string, orgId: string) {
    await this.get(id, orgId)
    return prisma.warehouse.update({ where: { id }, data: { isActive: false } })
  },

  // Статистика за день: сколько заказов отгружено со склада
  async dailyStats(id: string, orgId: string, date: Date) {
    const start = new Date(date); start.setHours(0, 0, 0, 0)
    const end   = new Date(date); end.setHours(23, 59, 59, 999)
    const [total, delivered, couriersOnShift] = await Promise.all([
      prisma.order.count({ where: { warehouseId: id, organizationId: orgId, createdAt: { gte: start, lte: end } } }),
      prisma.order.count({ where: { warehouseId: id, organizationId: orgId, status: 'DELIVERED', createdAt: { gte: start, lte: end } } }),
      prisma.shift.count({ where: { warehouseId: id, organizationId: orgId, status: 'ACTIVE' } }),
    ])
    return { total, delivered, pending: total - delivered, couriersOnShift }
  },
}
