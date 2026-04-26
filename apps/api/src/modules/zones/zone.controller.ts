import { Router } from 'express'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { validate } from '../../middleware/validate.middleware'
import { ok, CreateZoneSchema, UpdateZoneSchema } from '@delivery/shared'
import { zoneService } from './zone.service'

export const zonesRouter: Router = Router()

zonesRouter.post(
  '/',
  authenticate,
  authorize('ADMIN', 'ORG_ADMIN'),
  validate(CreateZoneSchema),
  async (req, res, next) => {
    try {
      res.status(201).json(ok(await zoneService.create(req.user!.organizationId!, req.body)))
    } catch (e) { next(e) }
  },
)

zonesRouter.get(
  '/',
  authenticate,
  authorize('ADMIN', 'ORG_ADMIN', 'SUPERVISOR'),
  async (req, res, next) => {
    try {
      res.json(ok(await zoneService.list(req.user!.organizationId!)))
    } catch (e) { next(e) }
  },
)

zonesRouter.get(
  '/for-point',
  authenticate,
  async (req, res, next) => {
    try {
      const lat = parseFloat(req.query.lat as string)
      const lon = parseFloat(req.query.lon as string)
      if (isNaN(lat) || isNaN(lon)) return res.status(400).json({ success: false, error: 'Нужны lat и lon' })
      res.json(ok(await zoneService.findForPoint(req.user!.organizationId!, lat, lon)))
    } catch (e) { next(e) }
  },
)

zonesRouter.get(
  '/:id',
  authenticate,
  authorize('ADMIN', 'ORG_ADMIN', 'SUPERVISOR'),
  async (req, res, next) => {
    try {
      res.json(ok(await zoneService.getById(req.params.id, req.user!.organizationId!)))
    } catch (e) { next(e) }
  },
)

zonesRouter.patch(
  '/:id',
  authenticate,
  authorize('ADMIN', 'ORG_ADMIN'),
  validate(UpdateZoneSchema),
  async (req, res, next) => {
    try {
      res.json(ok(await zoneService.update(req.params.id, req.user!.organizationId!, req.body)))
    } catch (e) { next(e) }
  },
)

zonesRouter.delete(
  '/:id',
  authenticate,
  authorize('ADMIN', 'ORG_ADMIN'),
  async (req, res, next) => {
    try {
      await zoneService.delete(req.params.id, req.user!.organizationId!)
      res.json(ok({ deleted: true }))
    } catch (e) { next(e) }
  },
)
