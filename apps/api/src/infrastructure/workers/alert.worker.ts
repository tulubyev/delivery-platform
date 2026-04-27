import { Worker, Queue } from 'bullmq'
import { createRedisConnection } from '../redis/redis'
import { QUEUE_NAMES } from '../queue/queues'
import { prisma } from '../db/prisma'
import { AlertType, AlertSeverity, OrderStatus } from '@prisma/client'

// Создаём алерт если такого ещё нет (дедупликация за последний час)
async function createAlertOnce(params: {
  organizationId: string
  type:           AlertType
  severity:       AlertSeverity
  entityType:     string
  entityId:       string
  message:        string
  meta?:          object
}) {
  const existing = await prisma.alert.findFirst({
    where: {
      organizationId: params.organizationId,
      type:           params.type,
      entityId:       params.entityId,
      resolvedAt:     null,
      createdAt:      { gte: new Date(Date.now() - 60 * 60_000) },
    },
  })
  if (!existing) await prisma.alert.create({ data: params })
}

async function runAlertChecks() {
  const orgs = await prisma.organization.findMany({
    where:  { isActive: true },
    select: { id: true, config: true },
  })

  await Promise.all(orgs.map(async org => {
    const cfg = org.config
    const offlineThresholdMs = (cfg?.offlineThresholdMin ?? 10) * 60_000
    const stuckThresholdMs   = (cfg?.stuckThresholdMin   ?? 15) * 60_000

    // CP-01: Курьер не выходил на связь > offlineThreshold
    const offlineCouriers = await prisma.courier.findMany({
      where: {
        organizationId: org.id,
        isOnline:       true,
        lastSeenAt:     { lt: new Date(Date.now() - offlineThresholdMs) },
      },
      select: { id: true, user: { select: { name: true } } },
    })
    for (const c of offlineCouriers) {
      await prisma.courier.update({ where: { id: c.id }, data: { isOnline: false } })
      await createAlertOnce({
        organizationId: org.id,
        type:           AlertType.COURIER_OFFLINE,
        severity:       AlertSeverity.HIGH,
        entityType:     'Courier',
        entityId:       c.id,
        message:        `Курьер ${c.user.name} не выходил на связь более ${cfg?.offlineThresholdMin ?? 10} минут`,
      })
    }

    // CP-02: Курьер с активным заказом не двигается > stuckThreshold
    const stuckCutoff = new Date(Date.now() - stuckThresholdMs)
    const stuckCouriers = await prisma.courier.findMany({
      where: {
        organizationId: org.id,
        isOnline:       true,
        lastSeenAt:     { lt: stuckCutoff },
        orders:         { some: { status: { in: [OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT] } } },
      },
      select: { id: true, user: { select: { name: true } } },
    })
    for (const c of stuckCouriers) {
      await createAlertOnce({
        organizationId: org.id,
        type:           AlertType.COURIER_STUCK,
        severity:       AlertSeverity.MEDIUM,
        entityType:     'Courier',
        entityId:       c.id,
        message:        `Курьер ${c.user.name} не двигается более ${cfg?.stuckThresholdMin ?? 15} минут`,
      })
    }

    // CP-03: Заказы с просроченным SLA
    const overdueOrders = await prisma.order.findMany({
      where: {
        organizationId: org.id,
        status:         { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.RETURNING] },
        slaDeadlineAt:  { lt: new Date() },
      },
      select: { id: true, number: true },
    })
    for (const o of overdueOrders) {
      await createAlertOnce({
        organizationId: org.id,
        type:           AlertType.ORDER_SLA_BREACH,
        severity:       AlertSeverity.CRITICAL,
        entityType:     'Order',
        entityId:       o.id,
        message:        `Заказ ${o.number} не доставлен в срок (SLA нарушен)`,
      })
    }

    // CP-04: Заказ CREATED без курьера более 15 минут
    const staleCutoff = new Date(Date.now() - 15 * 60_000)
    const staleOrders = await prisma.order.findMany({
      where: {
        organizationId: org.id,
        status:         OrderStatus.CREATED,
        courierId:      null,
        createdAt:      { lt: staleCutoff },
      },
      select: { id: true, number: true },
    })
    for (const o of staleOrders) {
      await createAlertOnce({
        organizationId: org.id,
        type:           AlertType.DISPATCH_FAILED,
        severity:       AlertSeverity.HIGH,
        entityType:     'Order',
        entityId:       o.id,
        message:        `Заказ ${o.number} без курьера более 15 минут`,
      })
    }

    // CP-05: GeoFence нарушения за последние 2 минуты
    const recentViolations = await prisma.geoFenceEvent.findMany({
      where: {
        courierId:  { in: (await prisma.courier.findMany({ where: { organizationId: org.id }, select: { id: true } })).map(c => c.id) },
        eventType:  'EXIT',
        occurredAt: { gte: new Date(Date.now() - 2 * 60_000) },
      },
      select: { courierId: true, zoneId: true },
    })
    for (const v of recentViolations) {
      await createAlertOnce({
        organizationId: org.id,
        type:           AlertType.GEOFENCE_VIOLATION,
        severity:       AlertSeverity.MEDIUM,
        entityType:     'Courier',
        entityId:       v.courierId,
        message:        `Курьер покинул назначенную зону`,
        meta:           { zoneId: v.zoneId },
      })
    }
  }))
}

export function startAlertWorker() {
  // Регистрируем repeatable job — каждые 60 сек
  const alertQueue = new Queue(QUEUE_NAMES.ALERT, { connection: createRedisConnection() })
  alertQueue.add('check', {}, { repeat: { every: 60_000 }, removeOnComplete: 10 })

  const worker = new Worker(
    QUEUE_NAMES.ALERT,
    async () => { await runAlertChecks() },
    { connection: createRedisConnection(), concurrency: 1 },
  )

  worker.on('failed', (_job, err) => console.error('[AlertWorker] failed:', err.message))
  console.log('✅ AlertWorker started (every 60s)')
  return worker
}
