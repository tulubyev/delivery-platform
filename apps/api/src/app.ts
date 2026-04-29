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
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) ?? []
app.use(cors({
  origin: allowedOrigins.length > 0
    ? (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin))
    : true,
  credentials: true,
}))

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
// GET /api/clients — список клиентов организации (для выпадающего списка при создании заказа)
app.get('/api/clients',
  authenticate, authorize('ADMIN', 'ORG_ADMIN', 'SUPERVISOR'),
  async (req, res, next) => {
    try {
      const clients = await prisma.client.findMany({
        where: { organizationId: req.user!.organizationId! },
        select: { id: true, companyName: true, user: { select: { name: true, email: true } } },
        orderBy: { user: { name: 'asc' } },
      })
      res.json(ok(clients.map(c => ({
        id: c.id,
        name: c.companyName ?? c.user.name,
        email: c.user.email,
      }))))
    } catch (e) { next(e) }
  },
)

// GET /api/clients/list — полный список клиентов с деталями (для страницы управления)
app.get('/api/clients/list',
  authenticate, authorize('ADMIN', 'ORG_ADMIN'),
  async (req, res, next) => {
    try {
      const clients = await prisma.client.findMany({
        where: { organizationId: req.user!.organizationId! },
        select: {
          id: true, companyName: true, inn: true, contractNo: true, createdAt: true,
          user: { select: { name: true, email: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
      res.json(ok(clients.map(c => ({
        id: c.id,
        name: c.user.name,
        email: c.user.email,
        phone: c.user.phone,
        companyName: c.companyName,
        inn: c.inn,
        contractNo: c.contractNo,
        createdAt: c.createdAt,
      }))))
    } catch (e) { next(e) }
  },
)

// POST /api/clients — создание B2B клиента администратором (без OTP)
app.post('/api/clients',
  authenticate, authorize('ADMIN', 'ORG_ADMIN'),
  async (req, res, next) => {
    try {
      const { name, email, phone, password, companyName, inn, contractNo } = req.body
      if (!name || !email || !phone || !password) {
        return res.status(400).json({ success: false, error: 'name, email, phone и password обязательны' })
      }
      const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { phone }] } })
      if (existing) return res.status(409).json({ success: false, error: 'Email или телефон уже зарегистрированы' })

      const bcrypt = await import('bcryptjs')
      const passwordHash = await bcrypt.hash(password, 10)

      const user = await prisma.user.create({
        data: {
          name, email, phone,
          passwordHash,
          role: 'CLIENT',
          phoneVerified: true,
          organizationId: req.user!.organizationId!,
        },
      })
      const client = await prisma.client.create({
        data: {
          userId: user.id,
          organizationId: req.user!.organizationId!,
          companyName: companyName || null,
          inn: inn || null,
          contractNo: contractNo || null,
        },
      })
      res.status(201).json(ok({ clientId: client.id, userId: user.id }))
    } catch (e) { next(e) }
  },
)

// GET /api/clients/me — CLIENT получает свой профиль (clientId нужен при создании заказа)
app.get('/api/clients/me',
  authenticate, authorize('CLIENT'),
  async (req, res, next) => {
    try {
      const client = await prisma.client.findUnique({
        where:  { userId: req.user!.sub },
        select: { id: true, companyName: true, inn: true, contractNo: true },
      })
      res.json(ok(client ? { clientId: client.id, ...client } : null))
    } catch (e) { next(e) }
  },
)

// GET /api/superadmin/admins — список ADMIN и ORG_ADMIN
app.get('/api/superadmin/admins',
  authenticate, authorize('ADMIN'),
  async (req, res, next) => {
    try {
      const users = await prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'ORG_ADMIN'] } },
        select: { id: true, name: true, email: true, role: true, organizationId: true, createdAt: true,
          organization: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      })
      res.json(ok(users))
    } catch (e) { next(e) }
  },
)

// POST /api/superadmin/admins — создание ORG_ADMIN суперадмином
app.post('/api/superadmin/admins',
  authenticate, authorize('ADMIN'),
  async (req, res, next) => {
    try {
      const { name, email, phone, password, organizationId } = req.body
      if (!name || !email || !phone || !password || !organizationId) {
        return res.status(400).json({ success: false, error: 'Все поля обязательны' })
      }
      const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { phone }] } })
      if (existing) return res.status(409).json({ success: false, error: 'Email или телефон уже зарегистрированы' })

      const bcrypt = await import('bcryptjs')
      const passwordHash = await bcrypt.hash(password, 10)
      const user = await prisma.user.create({
        data: { name, email, phone, passwordHash, role: 'ORG_ADMIN', phoneVerified: true, organizationId },
      })
      res.status(201).json(ok({ userId: user.id }))
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
