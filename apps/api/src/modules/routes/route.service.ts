import { prisma } from '../../infrastructure/db/prisma'
import { twogisClient, MatrixResult } from '../../infrastructure/twogis/twogis.client'
import { OrderStatus } from '@prisma/client'

// ─── TSP: nearest-neighbor + 2-opt ───────────────────────────────────────────

function nnTour(matrix: MatrixResult['rows'], start = 0): number[] {
  const n = matrix.length
  const visited = new Set<number>([start])
  const tour = [start]
  let current = start
  while (visited.size < n) {
    let nearest = -1
    let minCost = Infinity
    for (let j = 0; j < n; j++) {
      if (!visited.has(j)) {
        const cost = matrix[current][j]?.duration_seconds ?? Infinity
        if (cost < minCost) { minCost = cost; nearest = j }
      }
    }
    if (nearest === -1) break
    visited.add(nearest)
    tour.push(nearest)
    current = nearest
  }
  return tour
}

function tourCost(tour: number[], matrix: MatrixResult['rows']): number {
  let cost = 0
  for (let i = 0; i < tour.length - 1; i++) {
    cost += matrix[tour[i]][tour[i + 1]]?.duration_seconds ?? 0
  }
  return cost
}

function twoOpt(tour: number[], matrix: MatrixResult['rows']): number[] {
  let improved = true
  let best = [...tour]
  while (improved) {
    improved = false
    for (let i = 1; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const newTour = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)]
        if (tourCost(newTour, matrix) < tourCost(best, matrix)) {
          best = newTour; improved = true
        }
      }
    }
  }
  return best
}

// ─── Route building ──────────────────────────────────────────────────────────

export const routeService = {
  async buildRoute(courierId: string) {
    const courier = await prisma.courier.findUnique({
      where:  { id: courierId },
      select: { currentLat: true, currentLon: true, organizationId: true },
    })
    if (!courier?.currentLat || !courier?.currentLon) throw new Error('Courier position unknown')

    const orders = await prisma.order.findMany({
      where:  { courierId, status: { in: [OrderStatus.ASSIGNED, OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT] } },
      select: { id: true, deliveryAddress: true },
    })
    if (!orders.length) return null

    const stops: Array<{ orderId: string; lat: number; lon: number }> = []
    for (const o of orders) {
      const addr = o.deliveryAddress as { lat?: number; lon?: number }
      if (addr?.lat && addr?.lon) stops.push({ orderId: o.id, lat: addr.lat, lon: addr.lon })
    }
    if (!stops.length) return null

    // Points: [0] = courier position, [1..n] = delivery stops
    const points = [
      { lat: courier.currentLat, lon: courier.currentLon },
      ...stops.map(s => ({ lat: s.lat, lon: s.lon })),
    ]

    const matrix = await twogisClient.distanceMatrix(points)

    // TSP: optimize over all stop indices (1-based in the full matrix)
    const n = points.length
    const fullIndices = Array.from({ length: n }, (_, i) => i)
    const rawTour = nnTour(buildSubMatrix(matrix.rows, fullIndices), 0)
    const optTour = twoOpt(rawTour, buildSubMatrix(matrix.rows, fullIndices))

    // optTour is 0-based in the full matrix; skip index 0 (courier start)
    const orderedStops = optTour.slice(1).map(i => stops[i - 1])

    // Cumulative ETA in minutes
    let etaAccum = 0
    const stopData: Array<{ orderId: string; lat: number; lon: number; etaMin: number; position: number }> = []
    let prevIdx = 0
    for (let i = 0; i < orderedStops.length; i++) {
      const curIdx = optTour[i + 1]
      const cell   = matrix.rows[prevIdx][curIdx]
      etaAccum += Math.round((cell?.duration_seconds ?? 0) / 60)
      stopData.push({ orderId: orderedStops[i].orderId, lat: orderedStops[i].lat, lon: orderedStops[i].lon, etaMin: etaAccum, position: i })
      prevIdx = curIdx
    }

    // Get polyline for ordered route
    const routePoints = [{ lat: courier.currentLat, lon: courier.currentLon }, ...orderedStops]
    const segment     = await twogisClient.getRoute(routePoints)

    return prisma.$transaction(async tx => {
      // Cancel previous active route
      const existing = await tx.route.findFirst({
        where:  { courierId, date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
        select: { id: true },
      })
      if (existing) {
        await tx.routeStop.deleteMany({ where: { routeId: existing.id } })
        await tx.route.delete({ where: { id: existing.id } })
      }

      return tx.route.create({
        data: {
          courierId,
          organizationId:  courier.organizationId,
          date:            new Date(),
          totalKm:         segment.distance_meters / 1000,
          totalOrders:     stopData.length,
          estimatedMin:    Math.round(segment.duration_seconds / 60),
          polyline:        segment.polyline,
          stops: {
            create: stopData.map(s => ({
              orderId:  s.orderId,
              position: s.position,
              lat:      s.lat,
              lon:      s.lon,
              etaMin:   s.etaMin,
            })),
          },
        },
        include: { stops: { orderBy: { position: 'asc' } } },
      })
    })
  },

  async getActiveRoute(courierId: string) {
    return prisma.route.findFirst({
      where:   { courierId, date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      include: { stops: { orderBy: { position: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    })
  },

  async markStopArrived(courierId: string, orderId: string) {
    const route = await prisma.route.findFirst({
      where:   { courierId, date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      orderBy: { createdAt: 'desc' },
      select:  { id: true },
    })
    if (!route) throw Object.assign(new Error('No active route'), { status: 404 })
    await prisma.routeStop.updateMany({
      where: { routeId: route.id, orderId },
      data:  { arrivedAt: new Date() },
    })
  },
}

function buildSubMatrix(rows: MatrixResult['rows'], indices: number[]): MatrixResult['rows'] {
  return indices.map(i => indices.map(j => rows[i]?.[j] ?? null))
}
