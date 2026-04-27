import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import http from 'http'
import { WebSocketServer } from 'ws'
import { errorHandler } from './middleware/error.middleware'
import { authRouter } from './modules/users/auth.controller'
import { ordersRouter } from './modules/orders/order.controller'
import { trackingRouter } from './modules/tracking/tracking.controller'
import { publicTrackingRouter } from './modules/tracking/public-tracking.controller'
import { payoutsRouter } from './modules/payouts/payouts.controller'
import { couriersRouter } from './modules/couriers/courier.controller'
import { organizationsRouter } from './modules/organizations/organization.controller'
import { zonesRouter } from './modules/zones/zone.controller'
import { dispatchRouter } from './modules/dispatch/dispatch.controller'
import { alertsRouter } from './modules/alerts/alert.controller'
import { routesRouter } from './modules/routes/route.controller'
import { notificationsRouter } from './modules/notifications/notification.controller'
import { warehousesRouter } from './modules/warehouses/warehouse.controller'
import { pickupPointsRouter } from './modules/pickup-points/pickup-point.controller'
import { shiftsRouter } from './modules/shifts/shift.controller'
import { paymentsRouter } from './modules/payments/payment.controller'
import { wsManager } from './modules/ws/ws.manager'
import { authenticate, authorize } from './middleware/auth.middleware'
import { organizationService } from './modules/organizations/organization.service'
import { ok } from '@delivery/shared'
import { prisma } from './infrastructure/db/prisma'
import { startDispatchWorker, startOfferExpiryWorker } from './infrastructure/workers/dispatch.worker'
import { startAlertWorker } from './infrastructure/workers/alert.worker'
import { startRouteWorker } from './infrastructure/workers/route.worker'
import { startNotificationWorker } from './infrastructure/workers/notification.worker'
import { dispatchQueue } from './infrastructure/queue/queues'

const app = express()

app.use(helmet())
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') ?? '*', credentials: true }))

// YooKassa webhook нужен raw body ДО express.json()
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }))

app.use(express.json())
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

app.use('/api/auth',          authRouter)
app.use('/api/orders',        ordersRouter)
app.use('/api/tracking',      trackingRouter)
app.use('/api/payouts',       payoutsRouter)
app.use('/api/couriers',      couriersRouter)
app.use('/api/organizations', organizationsRouter)
app.use('/api/zones',         zonesRouter)
app.use('/api/dispatch',      dispatchRouter)
app.use('/api/alerts',        alertsRouter)
app.use('/api/routes',        routesRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/warehouses',    warehousesRouter)
app.use('/api/pickup-points', pickupPointsRouter)
app.use('/api/shifts',        shiftsRouter)
app.use('/api/payments',      paymentsRouter)
app.use('/track',             publicTrackingRouter)

// Shortcut: GET/PATCH /api/config — tenant config for current user's org
app.get('/api/config',
  authenticate, authorize('ADMIN', 'ORG_ADMIN'),
  async (req, res, next) => {
    try {
      const org = await organizationService.getById(req.user!.organizationId!)
      res.json(ok(org.config))
    } catch (e) { next(e) }
  },
)
app.patch('/api/config',
  authenticate, authorize('ADMIN', 'ORG_ADMIN'),
  async (req, res, next) => {
    try {
      res.json(ok(await organizationService.updateConfig(req.user!.organizationId!, req.body)))
    } catch (e) { next(e) }
  },
)
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }))
app.use(errorHandler)

const server = http.createServer(app)
const wss    = new WebSocketServer({ server, path: '/ws' })
wsManager.init(wss)

const PORT = Number(process.env.PORT ?? 3000)
server.listen(PORT, async () => {
  await prisma.$connect()

  startDispatchWorker()
  startOfferExpiryWorker()
  startAlertWorker()
  startRouteWorker()
  startNotificationWorker()

  console.log(`🚀 API  http://localhost:${PORT}`)
  console.log(`🔌 WS   ws://localhost:${PORT}/ws`)
})

process.on('SIGTERM', async () => {
  await Promise.all([
    prisma.$disconnect(),
    dispatchQueue.close(),
  ])
  server.close(() => process.exit(0))
})
