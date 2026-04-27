import { Router, Request, Response, NextFunction } from 'express'
import { alertService } from './alert.service'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { ok } from '@delivery/shared'
import { z } from 'zod'

export const alertsRouter: Router = Router()

const FiltersSchema = z.object({
  resolved:   z.enum(['true', 'false']).optional().transform(v => v === undefined ? undefined : v === 'true'),
  type:       z.string().optional(),
  severity:   z.string().optional(),
  entityType: z.string().optional(),
  page:       z.coerce.number().min(1).default(1),
  limit:      z.coerce.number().min(1).max(200).default(50),
})

alertsRouter.get(
  '/',
  authenticate,
  authorize('ADMIN', 'ORG_ADMIN', 'SUPERVISOR'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const f = FiltersSchema.parse(req.query)
      res.json(ok(await alertService.listAlerts(req.user!.organizationId!, f as Parameters<typeof alertService.listAlerts>[1])))
    } catch (e) { next(e) }
  },
)

alertsRouter.get(
  '/count',
  authenticate,
  authorize('ADMIN', 'ORG_ADMIN', 'SUPERVISOR'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(ok(await alertService.getUnresolvedCount(req.user!.organizationId!)))
    } catch (e) { next(e) }
  },
)

alertsRouter.patch(
  '/:id/resolve',
  authenticate,
  authorize('ADMIN', 'ORG_ADMIN', 'SUPERVISOR'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(ok(await alertService.resolveAlert(req.params.id, req.user!.organizationId!, req.user!.sub)))
    } catch (e) { next(e) }
  },
)

alertsRouter.post(
  '/resolve-many',
  authenticate,
  authorize('ADMIN', 'ORG_ADMIN', 'SUPERVISOR'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ids } = z.object({ ids: z.array(z.string()) }).parse(req.body)
      res.json(ok(await alertService.resolveMany(req.user!.organizationId!, ids, req.user!.sub)))
    } catch (e) { next(e) }
  },
)
