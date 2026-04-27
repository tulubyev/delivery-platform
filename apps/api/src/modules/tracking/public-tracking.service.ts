import { prisma } from '../../infrastructure/db/prisma'
import { redis } from '../../infrastructure/redis/redis'

const LOC_KEY = (id: string) => `courier:loc:${id}`

export const publicTrackingService = {
  async getByToken(token: string) {
    const tt = await prisma.trackingToken.findFirst({
      where:   { token, expiresAt: { gt: new Date() } },
      include: {
        order: {
          select: {
            id: true, number: true, status: true,
            slaDeadlineAt: true,
            courierId: true,
            pickupAddress: true, deliveryAddress: true,
            routeStops: { where: { arrivedAt: null }, orderBy: { position: 'asc' }, take: 1 },
          },
        },
      },
    })
    if (!tt) throw Object.assign(new Error('Tracking link not found or expired'), { status: 404 })

    const { order } = tt
    let courierPosition: { lat: number; lon: number; ts: number } | null = null

    if (order.courierId) {
      const cached = await redis.get(LOC_KEY(order.courierId))
      if (cached) courierPosition = JSON.parse(cached)
    }

    const nextStop = order.routeStops[0]
    return {
      orderId:         order.id,
      orderNumber:     order.number,
      status:          order.status,
      slaDeadlineAt:   order.slaDeadlineAt,
      courierPosition,
      nextStop: nextStop
        ? { lat: nextStop.lat, lon: nextStop.lon, etaMin: nextStop.etaMin }
        : null,
    }
  },
}
