import { Router, Request, Response, NextFunction } from 'express'
import { pickupPointService } from './pickup-point.service'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { ok } from '@delivery/shared'
import { z } from 'zod'

export const pickupPointsRouter: Router = Router()

const BodySchema = z.object({
  name:         z.string().min(1),
  address:      z.object({ city: z.string(), street: z.string(), building: z.string() }),
  lat:          z.number(),
  lon:          z.number(),
  workingHours: z.record(z.string()).optional(),
})

pickupPointsRouter.post(
  '/',
  authenticate, authorize('ADMIN', 'ORG_ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(ok(await pickupPointService.create(req.user!.organizationId!, BodySchema.parse(req.body))))
    } catch (e) { next(e) }
  },
)

pickupPointsRouter.get(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(ok(await pickupPointService.list(req.user!.organizationId!, req.query.includeInactive === 'true')))
    } catch (e) { next(e) }
  },
)

pickupPointsRouter.get(
  '/nearest',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const lat   = Number(req.query.lat)
      const lon   = Number(req.query.lon)
      const limit = Number(req.query.limitKm ?? 5)
      if (isNaN(lat) || isNaN(lon)) return res.status(400).json({ success: false, error: 'lat and lon required' })
      res.json(ok(await pickupPointService.findNearest(req.user!.organizationId!, lat, lon, limit)))
    } catch (e) { next(e) }
  },
)

pickupPointsRouter.get(
  '/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(ok(await pickupPointService.get(req.params.id, req.user!.organizationId!)))
    } catch (e) { next(e) }
  },
)

pickupPointsRouter.patch(
  '/:id',
  authenticate, authorize('ADMIN', 'ORG_ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(ok(await pickupPointService.update(req.params.id, req.user!.organizationId!, BodySchema.partial().parse(req.body))))
    } catch (e) { next(e) }
  },
)

pickupPointsRouter.delete(
  '/:id',
  authenticate, authorize('ADMIN', 'ORG_ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await pickupPointService.deactivate(req.params.id, req.user!.organizationId!)
      res.json(ok({ deactivated: true }))
    } catch (e) { next(e) }
  },
)
