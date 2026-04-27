import { Router, Request, Response, NextFunction } from 'express'
import { routeService } from './route.service'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { routeQueue } from '../../infrastructure/queue/queues'
import { ok } from '@delivery/shared'
import { prisma } from '../../infrastructure/db/prisma'

export const routesRouter: Router = Router()

// GET текущий маршрут курьера
routesRouter.get(
  '/courier/:courierId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(ok(await routeService.getActiveRoute(req.params.courierId)))
    } catch (e) { next(e) }
  },
)

// POST /routes/courier/:courierId/build — запустить пересчёт маршрута
routesRouter.post(
  '/courier/:courierId/build',
  authenticate,
  authorize('ADMIN', 'ORG_ADMIN', 'SUPERVISOR'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await routeQueue.add('build', { courierId: req.params.courierId }, { jobId: `route:${req.params.courierId}` })
      res.json(ok({ queued: true }))
    } catch (e) { next(e) }
  },
)

// PATCH /routes/courier/:courierId/stop/:orderId/arrived — курьер прибыл к точке
routesRouter.patch(
  '/courier/:courierId/stop/:orderId/arrived',
  authenticate,
  authorize('COURIER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await routeService.markStopArrived(req.params.courierId, req.params.orderId)
      res.json(ok({ marked: true }))
    } catch (e) { next(e) }
  },
)

// GET /routes/geocode?address=... — геокодирование адреса
routesRouter.get(
  '/geocode',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { twogisClient } = await import('../../infrastructure/twogis/twogis.client')
      const address = req.query.address as string
      if (!address) return res.status(400).json({ success: false, error: 'address required' })
      res.json(ok(await twogisClient.geocode(address)))
    } catch (e) { next(e) }
  },
)
