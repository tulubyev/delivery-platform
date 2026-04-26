import { Router } from 'express'
import { VerificationStatus } from '@prisma/client'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { validate } from '../../middleware/validate.middleware'
import { ok } from '@delivery/shared'
import { SubmitDocumentsSchema, ReviewDocumentsSchema } from '@delivery/shared'
import { courierService } from './courier.service'

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

// Admin/Dispatcher: list couriers with optional filter by verificationStatus
couriersRouter.get(
  '/',
  authenticate,
  authorize('ADMIN', 'DISPATCHER'),
  async (req, res, next) => {
    try {
      const page  = Math.max(1, Number(req.query.page)  || 1)
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20))
      const vs    = req.query.verificationStatus as VerificationStatus | undefined
      res.json(ok(await courierService.list({ verificationStatus: vs, page, limit })))
    } catch (e) { next(e) }
  },
)

// Admin/Dispatcher: approve or reject a courier's documents
couriersRouter.patch(
  '/:id/verify',
  authenticate,
  authorize('ADMIN', 'DISPATCHER'),
  validate(ReviewDocumentsSchema),
  async (req, res, next) => {
    try {
      res.json(ok(await courierService.reviewDocuments(req.params.id, req.user!.sub, req.body)))
    } catch (e) { next(e) }
  },
)
