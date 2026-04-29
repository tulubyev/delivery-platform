import { Router, Request, Response, NextFunction } from 'express'
import { shiftService } from './shift.service'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { ok } from '@delivery/shared'
import { z } from 'zod'
import { ShiftStatus } from '@prisma/client'
import { prisma } from '../../infrastructure/db/prisma'

export const shiftsRouter: Router = Router()

const CreateSchema = z.object({
  courierId:      z.string().uuid(),
  zoneId:         z.string().uuid().optional(),
  warehouseId:    z.string().uuid().optional(),
  scheduledStart: z.coerce.date(),
  scheduledEnd:   z.coerce.date(),
}).refine(d => d.scheduledEnd > d.scheduledStart, { message: 'scheduledEnd must be after scheduledStart' })

// POST / — создать смену
shiftsRouter.post(
  '/',
  authenticate, authorize('ADMIN', 'ORG_ADMIN', 'SUPERVISOR'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(ok(await shiftService.create(req.user!.organizationId!, CreateSchema.parse(req.body))))
    } catch (e) { next(e) }
  },
)

// GET / — список смен с фильтрами
shiftsRouter.get(
  '/',
  authenticate, authorize('ADMIN', 'ORG_ADMIN', 'SUPERVISOR', 'COURIER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let courierId = req.query.courierId as string | undefined
      let orgId = req.user!.organizationId!
      // Курьер видит только свои смены; organizationId берём из courier-записи
      if (req.user!.role === 'COURIER') {
        const courier = await prisma.courier.findUnique({
          where: { userId: req.user!.sub },
          select: { id: true, organizationId: true },
        })
        courierId = courier?.id
        orgId = courier?.organizationId ?? orgId
      }
      const filters = {
        courierId,
        date:   req.query.date ? new Date(req.query.date as string) : undefined,
        status: req.query.status as ShiftStatus | undefined,
      }
      res.json(ok(await shiftService.list(orgId, filters)))
    } catch (e) { next(e) }
  },
)

// GET /active — смены прямо сейчас (для карты супервизора)
shiftsRouter.get(
  '/active',
  authenticate, authorize('ADMIN', 'ORG_ADMIN', 'SUPERVISOR'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(ok(await shiftService.getActiveNow(req.user!.organizationId!)))
    } catch (e) { next(e) }
  },
)

// GET /:id
shiftsRouter.get(
  '/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(ok(await shiftService.get(req.params.id, req.user!.organizationId!)))
    } catch (e) { next(e) }
  },
)

// PATCH /:id — обновить расписание
shiftsRouter.patch(
  '/:id',
  authenticate, authorize('ADMIN', 'ORG_ADMIN', 'SUPERVISOR'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = z.object({
        zoneId:         z.string().uuid().optional(),
        warehouseId:    z.string().uuid().optional(),
        scheduledStart: z.coerce.date().optional(),
        scheduledEnd:   z.coerce.date().optional(),
      }).parse(req.body)
      res.json(ok(await shiftService.update(req.params.id, req.user!.organizationId!, data)))
    } catch (e) { next(e) }
  },
)

// POST /:id/start — курьер открывает свою смену
shiftsRouter.post(
  '/:id/start',
  authenticate, authorize('COURIER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courier = await prisma.courier.findUnique({ where: { userId: req.user!.sub }, select: { id: true } })
      if (!courier) return res.status(404).json({ success: false, error: 'Courier not found' })
      res.json(ok(await shiftService.startShift(req.params.id, courier.id)))
    } catch (e) { next(e) }
  },
)

// POST /:id/end — курьер закрывает смену
shiftsRouter.post(
  '/:id/end',
  authenticate, authorize('COURIER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courier = await prisma.courier.findUnique({ where: { userId: req.user!.sub }, select: { id: true } })
      if (!courier) return res.status(404).json({ success: false, error: 'Courier not found' })
      res.json(ok(await shiftService.endShift(req.params.id, courier.id)))
    } catch (e) { next(e) }
  },
)

// DELETE /:id — отменить смену
shiftsRouter.delete(
  '/:id',
  authenticate, authorize('ADMIN', 'ORG_ADMIN', 'SUPERVISOR'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(ok(await shiftService.cancel(req.params.id, req.user!.organizationId!)))
    } catch (e) { next(e) }
  },
)
