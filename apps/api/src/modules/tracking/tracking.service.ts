import { redis } from '../../infrastructure/redis/redis'
import { prisma } from '../../infrastructure/db/prisma'
import { GeoPoint } from '@delivery/shared'

const LOC_KEY = (id: string) => `courier:loc:${id}`

export const trackingService = {
  async updateCourierLocation(point: GeoPoint) {
    const { courierId, lat, lon, speed, heading, timestamp } = point
    await prisma.courier.update({ where: { id: courierId }, data: { currentLat: lat, currentLon: lon, lastSeenAt: new Date() } })
    await prisma.locationLog.create({ data: { courierId, lat, lon, speed, heading, timestamp: timestamp ?? new Date() } })
    await redis.setex(LOC_KEY(courierId), 300, JSON.stringify({ lat, lon, speed, heading, ts: Date.now() }))
    // broadcast handled in ws.manager
  },

  async getCourierLocation(courierId: string) {
    const cached = await redis.get(LOC_KEY(courierId))
    if (cached) return JSON.parse(cached)
    return prisma.courier.findUnique({ where: { id: courierId }, select: { currentLat: true, currentLon: true, lastSeenAt: true } })
  },

  async getOnlineCouriers() {
    return prisma.courier.findMany({
      where: { isOnline: true },
      select: { id: true, vehicleType: true, currentLat: true, currentLon: true, lastSeenAt: true, user: { select: { name: true, phone: true } } },
    })
  },

  estimateEta(fromLat: number, fromLon: number, toLat: number, toLon: number, speedKmh = 25): number {
    const R = 6371
    const dLat = ((toLat - fromLat) * Math.PI) / 180
    const dLon = ((toLon - fromLon) * Math.PI) / 180
    const a = Math.sin(dLat/2)**2 + Math.cos(fromLat*Math.PI/180)*Math.cos(toLat*Math.PI/180)*Math.sin(dLon/2)**2
    return Math.round((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) / speedKmh) * 60)
  },
}
