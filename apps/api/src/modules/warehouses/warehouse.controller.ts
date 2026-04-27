import { Router, Request, Response, NextFunction } from 'express'
import { warehouseService } from './warehouse.service'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { ok } from '@delivery/shared'
import { z } from 'zod'

export const warehousesRouter: Router = Router()

const BodySchema = z.object({
  name:    z.string().min(1),
  address: z.object({ city: z.string(), street: z.string(), building: z.string() }),
  lat:     z.number(),
  lon:     z.number(),
})

warehousesRouter.post(
  '/',
  authenticate, authorize('ADMIN', 'ORG_ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(ok(await warehouseService.create(req.user!.organizationId!, BodySchema.parse(req.body))))
    } catch (e) { next(e) }
  },
)

warehousesRouter.get(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const includeInactive = req.query.includeInactive === 'true'
      res.json(ok(await warehouseService.list(req.user!.organizationId!, includeInactive)))
    } catch (e) { next(e) }
  },
)

warehousesRouter.get(
  '/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(ok(await warehouseService.get(req.params.id, req.user!.organizationId!)))
    } catch (e) { next(e) }
  },
)

warehousesRouter.patch(
  '/:id',
  authenticate, authorize('ADMIN', 'ORG_ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(ok(await warehouseService.update(req.params.id, req.user!.organizationId!, BodySchema.partial().parse(req.body))))
    } catch (e) { next(e) }
  },
)

warehousesRouter.delete(
  '/:id',
  authenticate, authorize('ADMIN', 'ORG_ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await warehouseService.deactivate(req.params.id, req.user!.organizationId!)
      res.json(ok({ deactivated: true }))
    } catch (e) { next(e) }
  },
)

warehousesRouter.get(
  '/:id/stats',
  authenticate, authorize('ADMIN', 'ORG_ADMIN', 'SUPERVISOR'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const date = req.query.date ? new Date(req.query.date as string) : new Date()
      res.json(ok(await warehouseService.dailyStats(req.params.id, req.user!.organizationId!, date)))
    } catch (e) { next(e) }
  },
)
