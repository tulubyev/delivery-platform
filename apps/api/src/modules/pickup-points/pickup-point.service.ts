import { prisma } from '../../infrastructure/db/prisma'

type WorkingHours = Partial<Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', string>>

export const pickupPointService = {
  async create(orgId: string, data: { name: string; address: object; lat: number; lon: number; workingHours?: WorkingHours }) {
    return prisma.pickupPoint.create({
      data: { organizationId: orgId, ...data },
    })
  },

  async list(orgId: string, includeInactive = false) {
    return prisma.pickupPoint.findMany({
      where:   { organizationId: orgId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: { name: 'asc' },
    })
  },

  async get(id: string, orgId: string) {
    const pp = await prisma.pickupPoint.findFirst({ where: { id, organizationId: orgId } })
    if (!pp) throw Object.assign(new Error('Pickup point not found'), { status: 404 })
    return pp
  },

  async update(id: string, orgId: string, data: Partial<{ name: string; address: object; lat: number; lon: number; workingHours: WorkingHours; isActive: boolean }>) {
    await this.get(id, orgId)
    return prisma.pickupPoint.update({ where: { id }, data })
  },

  async deactivate(id: string, orgId: string) {
    await this.get(id, orgId)
    return prisma.pickupPoint.update({ where: { id }, data: { isActive: false } })
  },

  // Найти ближайший активный ПВЗ к точке
  async findNearest(orgId: string, lat: number, lon: number, limitKm = 5) {
    const all = await prisma.pickupPoint.findMany({
      where: { organizationId: orgId, isActive: true },
    })
    const { haversineKm } = await import('../zones/zone.service')
    return all
      .map(pp => ({ ...pp, distKm: haversineKm(lat, lon, pp.lat, pp.lon) }))
      .filter(pp => pp.distKm <= limitKm)
      .sort((a, b) => a.distKm - b.distKm)
  },
}
