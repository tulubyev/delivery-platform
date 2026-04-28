import { prisma } from '../../infrastructure/db/prisma'
import { AppError } from '../../middleware/error.middleware'
import { CreateZoneDto, UpdateZoneDto } from '@delivery/shared'

// ── Геометрия ─────────────────────────────────────────────────────────────────

// GeoJSON: координаты в формате [longitude, latitude]
type GeoJsonPolygon = { type: 'Polygon'; coordinates: [number, number][][] }

// Ray-casting алгоритм: точка внутри полигона?
function pointInPolygon(lat: number, lon: number, polygon: GeoJsonPolygon): boolean {
  const ring = polygon.coordinates[0] // внешнее кольцо
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] // [lon, lat]
    const [xj, yj] = ring[j]
    const intersect = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

// Формула Хаверсина: расстояние между двумя точками в км
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Сервис ────────────────────────────────────────────────────────────────────

export const zoneService = {
  async create(orgId: string, dto: CreateZoneDto) {
    return prisma.zone.create({
      data: {
        organizationId: orgId,
        name:           dto.name,
        polygon:        dto.polygon as object,
        basePrice:      dto.basePrice ?? 0,
        pricePerKm:     dto.pricePerKm ?? 0,
        maxDeliveryMin: dto.maxDeliveryMin ?? 60,
      },
    })
  },

  async list(orgId: string) {
    return prisma.zone.findMany({
      where:   { organizationId: orgId, isActive: true },
      orderBy: { name: 'asc' },
    })
  },

  async getById(id: string, orgId: string) {
    const zone = await prisma.zone.findFirst({ where: { id, organizationId: orgId } })
    if (!zone) throw new AppError(404, 'Зона не найдена')
    return zone
  },

  async update(id: string, orgId: string, dto: UpdateZoneDto) {
    await this.getById(id, orgId)
    return prisma.zone.update({ where: { id }, data: { ...dto, polygon: dto.polygon as object | undefined } })
  },

  async delete(id: string, orgId: string) {
    await this.getById(id, orgId)
    // мягкое удаление
    return prisma.zone.update({ where: { id }, data: { isActive: false } })
  },

  // Найти зону по координатам (point-in-polygon)
  async findForPoint(orgId: string, lat: number, lon: number) {
    const zones = await prisma.zone.findMany({
      where: { organizationId: orgId, isActive: true },
    })

    const matches = zones.filter(z =>
      pointInPolygon(lat, lon, z.polygon as unknown as GeoJsonPolygon),
    )

    if (matches.length === 0) return null
    // При попадании в несколько зон — выбираем с минимальным maxDeliveryMin
    return matches.sort((a, b) => a.maxDeliveryMin - b.maxDeliveryMin)[0]
  },

  // Рассчитать стоимость доставки для зоны
  calculatePrice(zone: { basePrice: number; pricePerKm: number }, distanceKm: number): number {
    return Math.round((zone.basePrice + zone.pricePerKm * distanceKm) * 100) / 100
  },
}
