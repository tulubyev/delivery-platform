import { OrderStatus } from '@prisma/client'
import { redis } from '../../infrastructure/redis/redis'
import { prisma } from '../../infrastructure/db/prisma'
import { GeoPoint } from '@delivery/shared'
import { haversineKm } from '../zones/zone.service'

const LOC_KEY      = (id: string) => `courier:loc:${id}`
const COURIER_CHAN  = (id: string) => `courier:${id}`

export const trackingService = {
  async updateCourierLocation(point: GeoPoint) {
    const { courierId, lat, lon, speed, heading, accuracy, timestamp } = point
    const ts = timestamp ? new Date(timestamp) : new Date()

    // 1. Обновляем текущую позицию курьера
    await prisma.courier.update({
      where: { id: courierId },
      data:  { currentLat: lat, currentLon: lon, lastSeenAt: ts, isOnline: true },
    })

    // 2. Пишем в лог (история трека)
    await prisma.locationLog.create({
      data: { courierId, lat, lon, speed, heading, accuracy, timestamp: ts },
    })

    // 3. Кэш в Redis (5 мин TTL)
    await redis.setex(LOC_KEY(courierId), 300, JSON.stringify({ lat, lon, speed, heading, ts: ts.getTime() }))

    // 4. Pub/Sub — рассылаем всем подписчикам канала courier:{id}
    await redis.publish(COURIER_CHAN(courierId), JSON.stringify({ type: 'COURIER_LOCATION', payload: point }))

    // 5. ETA: пересчитываем для активного заказа курьера
    await this._recalcEta(courierId, lat, lon)

    // 6. Geofence — проверка что курьер в зоне своей смены
    await this._checkGeofence(courierId, lat, lon)
  },

  async getCourierLocation(courierId: string) {
    const cached = await redis.get(LOC_KEY(courierId))
    if (cached) return JSON.parse(cached)
    return prisma.courier.findUnique({
      where:  { id: courierId },
      select: { currentLat: true, currentLon: true, lastSeenAt: true },
    })
  },

  async getOnlineCouriers(orgId: string) {
    return prisma.courier.findMany({
      where:  { organizationId: orgId, isOnline: true },
      select: {
        id: true, vehicleType: true,
        currentLat: true, currentLon: true, lastSeenAt: true,
        user: { select: { name: true } },
      },
    })
  },

  async getLocationHistory(courierId: string, from: Date, to: Date) {
    return prisma.locationLog.findMany({
      where:   { courierId, timestamp: { gte: from, lte: to } },
      orderBy: { timestamp: 'asc' },
      select:  { lat: true, lon: true, speed: true, heading: true, timestamp: true },
    })
  },

  // Пересчёт ETA для активного заказа курьера
  async _recalcEta(courierId: string, lat: number, lon: number) {
    const activeOrder = await prisma.order.findFirst({
      where:  { courierId, status: { in: [OrderStatus.ASSIGNED, OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT] } },
      include: { routeStops: { where: { arrivedAt: null }, orderBy: { position: 'asc' }, take: 1 } },
    })
    if (!activeOrder) return

    // Следующая точка маршрута или адрес доставки
    const nextStop = activeOrder.routeStops[0]
    const targetLat = nextStop?.lat ?? (activeOrder.pickupAddress as { lat?: number })?.lat
    const targetLon = nextStop?.lon ?? (activeOrder.pickupAddress as { lon?: number })?.lon
    if (!targetLat || !targetLon) return

    const distKm    = haversineKm(lat, lon, targetLat, targetLon)
    const speedKmh  = 25 // средняя скорость в городе
    const etaMin    = Math.round((distKm / speedKmh) * 60)

    await prisma.etaSnapshot.create({
      data: { orderId: activeOrder.id, courierId, etaMinutes: etaMin, distanceKm: distKm },
    })

    // Уведомление "курьер рядом" — если ETA ≤ 10 минут и не отправляли раньше
    if (etaMin <= 10) {
      const alreadySent = await prisma.recipientContact.findFirst({
        where: { orderId: activeOrder.id, channel: 'SMS', body: { contains: 'рядом' } },
      })
      if (!alreadySent) {
        // Добавляем в очередь уведомлений (импортируем лениво чтобы избежать circular)
        const { notificationQueue } = await import('../../infrastructure/queue/queues')
        await notificationQueue.add('courier-nearby', {
          orderId: activeOrder.id,
          etaMin,
          courierId,
        })
      }
    }
  },

  // Проверка geofence — курьер вышел из зоны своей смены?
  async _checkGeofence(courierId: string, lat: number, lon: number) {
    const courier = await prisma.courier.findUnique({
      where:   { id: courierId },
      include: { shifts: { where: { status: 'ACTIVE' }, include: { zone: true }, take: 1 } },
    })
    const activeShift = courier?.shifts[0]
    if (!activeShift?.zone) return

    // Импортируем pointInPolygon через zoneService
    const { zoneService } = await import('../zones/zone.service')
    const zone = await zoneService.findForPoint(courier!.organizationId, lat, lon)

    if (!zone || zone.id !== activeShift.zoneId) {
      // Курьер вышел из зоны — пишем событие (дедупликация: не чаще 1 раза в 5 мин)
      const recentEvent = await prisma.geoFenceEvent.findFirst({
        where: {
          courierId,
          eventType:  'EXIT',
          occurredAt: { gte: new Date(Date.now() - 5 * 60_000) },
        },
      })
      if (!recentEvent) {
        await prisma.geoFenceEvent.create({
          data: { courierId, zoneId: activeShift.zoneId!, eventType: 'EXIT', lat, lon, occurredAt: new Date() },
        })
      }
    }
  },

  estimateEta(fromLat: number, fromLon: number, toLat: number, toLon: number, speedKmh = 25): number {
    const distKm = haversineKm(fromLat, fromLon, toLat, toLon)
    return Math.round((distKm / speedKmh) * 60)
  },
}
