import { Router } from 'express'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { validate } from '../../middleware/validate.middleware'
import { ok } from '@delivery/shared'
import {
  CreateOrganizationSchema,
  UpdateOrganizationSchema,
  UpdateTenantConfigSchema,
} from '@delivery/shared'
import { organizationService } from './organization.service'

export const organizationsRouter : Router = Router()

// ADMIN: создать организацию
organizationsRouter.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  validate(CreateOrganizationSchema),
  async (req, res, next) => {
    try {
      res.status(201).json(ok(await organizationService.create(req.body)))
    } catch (e) { next(e) }
  },
)

// ADMIN: список организаций
organizationsRouter.get(
  '/',
  authenticate,
  authorize('ADMIN'),
  async (req, res, next) => {
    try {
      const page  = Math.max(1, Number(req.query.page) || 1)
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20))
      res.json(ok(await organizationService.list(page, limit)))
    } catch (e) { next(e) }
  },
)

// ADMIN, ORG_ADMIN: получить организацию
organizationsRouter.get(
  '/:id',
  authenticate,
  authorize('ADMIN', 'ORG_ADMIN'),
  async (req, res, next) => {
    try {
      const org = await organizationService.getById(req.params.id)
      // ORG_ADMIN видит только свою организацию
      if (req.user!.role === 'ORG_ADMIN' && org.id !== req.user!.sub) {
        return res.status(403).json({ success: false, error: 'Недостаточно прав' })
      }
      res.json(ok(org))
    } catch (e) { next(e) }
  },
)

// ADMIN, ORG_ADMIN: обновить организацию
organizationsRouter.patch(
  '/:id',
  authenticate,
  authorize('ADMIN', 'ORG_ADMIN'),
  validate(UpdateOrganizationSchema),
  async (req, res, next) => {
    try {
      res.json(ok(await organizationService.update(req.params.id, req.body)))
    } catch (e) { next(e) }
  },
)

// ADMIN, ORG_ADMIN: обновить конфигурацию тенанта
organizationsRouter.patch(
  '/:id/config',
  authenticate,
  authorize('ADMIN', 'ORG_ADMIN'),
  validate(UpdateTenantConfigSchema),
  async (req, res, next) => {
    try {
      res.json(ok(await organizationService.updateConfig(req.params.id, req.body)))
    } catch (e) { next(e) }
  },
)

// ADMIN: деактивировать организацию
organizationsRouter.delete(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  async (req, res, next) => {
    try {
      await organizationService.deactivate(req.params.id)
      res.json(ok({ deactivated: true }))
    } catch (e) { next(e) }
  },
)
