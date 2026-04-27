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
import { wsManager } from './modules/ws/ws.manager'
import { prisma } from './infrastructure/db/prisma'
import { startDispatchWorker, startOfferExpiryWorker } from './infrastructure/workers/dispatch.worker'
import { startAlertWorker } from './infrastructure/workers/alert.worker'
import { startRouteWorker } from './infrastructure/workers/route.worker'
import { dispatchQueue } from './infrastructure/queue/queues'

const app = express()

app.use(helmet())
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') ?? '*', credentials: true }))
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
app.use('/track',             publicTrackingRouter)
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }))
app.use(errorHandler)

const server = http.createServer(app)
const wss    = new WebSocketServer({ server, path: '/ws' })
wsManager.init(wss)

const PORT = Number(process.env.PORT ?? 3000)
server.listen(PORT, async () => {
  await prisma.$connect()

  // BullMQ Workers
  startDispatchWorker()
  startOfferExpiryWorker()
  startAlertWorker()
  startRouteWorker()

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
