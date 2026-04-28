import { Router } from 'express'
import { VerificationStatus } from '@prisma/client'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { validate } from '../../middleware/validate.middleware'
import { ok } from '@delivery/shared'
import { SubmitDocumentsSchema, ReviewDocumentsSchema } from '@delivery/shared'
import { courierService } from './courier.service'
import { prisma } from '../../infrastructure/db/prisma'

export const couriersRouter : Router = Router()

// Courier: get own profile
couriersRouter.get(
  '/me',
  authenticate,
  authorize('COURIER'),
  async (req, res, next) => {
    try {
      res.json(ok(await courierService.getProfile(req.user!.sub)))
    } catch (e) { next(e) }
  },
)

// Courier: get own stats (today / week / month)
couriersRouter.get(
  '/me/stats',
  authenticate,
  authorize('COURIER'),
  async (req, res, next) => {
    try {
      const courier = await prisma.courier.findUnique({ where: { userId: req.user!.sub } })
      if (!courier) return res.status(404).json({ success: false, error: 'Профиль курьера не найден' })

      const now      = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const weekStart  = new Date(now); weekStart.setDate(now.getDate() - 7)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

      const buildStats = async (from: Date) => {
        const orders = await prisma.order.findMany({
          where: {
            courierId:   courier.id,
            deliveredAt: { gte: from },
          },
          select: { totalPrice: true, deliveredAt: true, createdAt: true },
        })
        return {
          orders:   orders.length,
          earnings: orders.reduce((s, o) => s + Number(o.totalPrice ?? 0), 0),
        }
      }

      const [today, week, month] = await Promise.all([
        buildStats(todayStart),
        buildStats(weekStart),
        buildStats(monthStart),
      ])

      // Активные заказы прямо сейчас
      const active = await prisma.order.count({
        where: { courierId: courier.id, deliveredAt: null, cancelledAt: null },
      })

      res.json(ok({
        today,
        week,
        month,
        active,
        rating: courier.rating ?? 0,
        isOnline: courier.isOnline,
      }))
    } catch (e) { next(e) }
  },
)

// Courier: get planned orders for a date (route planning)
couriersRouter.get(
  '/me/plan',
  authenticate,
  authorize('COURIER'),
  async (req, res, next) => {
    try {
      const courier = await prisma.courier.findUnique({ where: { userId: req.user!.sub } })
      if (!courier) return res.status(404).json({ success: false, error: 'Профиль не найден' })

      const dateStr = req.query.date as string | undefined
      const date    = dateStr ? new Date(dateStr) : new Date()
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const dayEnd   = new Date(dayStart.getTime() + 86_400_000)

      const orders = await prisma.order.findMany({
        where: {
          courierId: courier.id,
          createdAt: { gte: dayStart, lt: dayEnd },
          cancelledAt: null,
        },
        include: {
          pickupPoint: { select: { address: true, lat: true, lon: true } },
        },
        orderBy: { createdAt: 'asc' },
      })

      res.json(ok(orders))
    } catch (e) { next(e) }
  },
)

// Courier: submit passport + INN for verification
couriersRouter.post(
  '/me/documents',
  authenticate,
  authorize('COURIER'),
  validate(SubmitDocumentsSchema),
  async (req, res, next) => {
    try {
      res.json(ok(await courierService.submitDocuments(req.user!.sub, req.body)))
    } catch (e) { next(e) }
  },
)

// Admin/Supervisor: list couriers
couriersRouter.get(
  '/',
  authenticate,
  authorize('ADMIN', 'ORG_ADMIN', 'SUPERVISOR'),
  async (req, res, next) => {
    try {
      const page  = Math.max(1, Number(req.query.page)  || 1)
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20))
      const vs    = req.query.verificationStatus as VerificationStatus | undefined
      res.json(ok(await courierService.list({ verificationStatus: vs, page, limit })))
    } catch (e) { next(e) }
  },
)

// Courier: save Expo push token
couriersRouter.patch(
  '/:id/push-token',
  authenticate,
  authorize('COURIER'),
  async (req, res, next) => {
    try {
      const { expoPushToken } = req.body
      if (!expoPushToken || typeof expoPushToken !== 'string')
        return res.status(400).json({ error: 'expoPushToken required' })
      res.json(ok(await courierService.savePushToken(req.params.id, expoPushToken)))
    } catch (e) { next(e) }
  },
)

// Admin/Supervisor: approve or reject courier documents
couriersRouter.patch(
  '/:id/verify',
  authenticate,
  authorize('ADMIN', 'ORG_ADMIN'),
  validate(ReviewDocumentsSchema),
  async (req, res, next) => {
    try {
      res.json(ok(await courierService.reviewDocuments(req.params.id, req.user!.sub, req.body)))
    } catch (e) { next(e) }
  },
)
