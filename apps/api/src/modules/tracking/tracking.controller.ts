import { Router, Request, Response, NextFunction } from 'express'
import { trackingService } from './tracking.service'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { validate } from '../../middleware/validate.middleware'
import { ok, GeoPointSchema } from '@delivery/shared'
import { prisma } from '../../infrastructure/db/prisma'
import { wsManager } from '../ws/ws.manager'

export const trackingRouter: Router = Router()

// HTTP endpoint для background GPS (когда WS недоступен — iOS background)
trackingRouter.post(
  '/location',
  authenticate,
  authorize('COURIER'),
  validate(GeoPointSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courier = await prisma.courier.findUnique({ where: { userId: req.user!.sub } })
      if (!courier) return res.status(404).json({ success: false, error: 'Курьер не найден' })

      const point = { ...req.body, courierId: courier.id }
      await trackingService.updateCourierLocation(point)

      // Fan-out через WS подписчикам (если есть активные соединения)
      wsManager.broadcast(`courier:${courier.id}`, { type: 'COURIER_LOCATION', payload: point })

      res.json(ok({ received: true }))
    } catch (e) { next(e) }
  },
)

// Текущая позиция одного курьера
trackingRouter.get(
  '/courier/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(ok(await trackingService.getCourierLocation(req.params.id)))
    } catch (e) { next(e) }
  },
)

// Все онлайн-курьеры организации (для карты супервизора)
trackingRouter.get(
  '/online',
  authenticate,
  authorize('ADMIN', 'ORG_ADMIN', 'SUPERVISOR'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(ok(await trackingService.getOnlineCouriers(req.user!.organizationId!)))
    } catch (e) { next(e) }
  },
)

// История трека курьера за период
trackingRouter.get(
  '/courier/:id/history',
  authenticate,
  authorize('ADMIN', 'ORG_ADMIN', 'SUPERVISOR'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const from = new Date(req.query.from as string ?? Date.now() - 8 * 3600_000)
      const to   = new Date(req.query.to   as string ?? Date.now())
      res.json(ok(await trackingService.getLocationHistory(req.params.id, from, to)))
    } catch (e) { next(e) }
  },
)
