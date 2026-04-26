import { Router } from 'express'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { validate } from '../../middleware/validate.middleware'
import { ok, CreateOrderSchema, UpdateOrderStatusSchema, AssignOrderSchema, OrderFiltersSchema } from '@delivery/shared'
import { orderService } from './order.service'

export const ordersRouter : Router = Router()

// Создать заказ — CLIENT, ORG_ADMIN
ordersRouter.post(
  '/',
  authenticate,
  authorize('CLIENT', 'ORG_ADMIN', 'ADMIN'),
  validate(CreateOrderSchema),
  async (req, res, next) => {
    try {
      const orgId = req.user!.organizationId!
      res.status(201).json(ok(await orderService.create(orgId, req.body)))
    } catch (e) { next(e) }
  },
)

// Список заказов — все роли организации
ordersRouter.get(
  '/',
  authenticate,
  authorize('ADMIN', 'ORG_ADMIN', 'SUPERVISOR', 'CLIENT'),
  async (req, res, next) => {
    try {
      const filters = OrderFiltersSchema.parse(req.query)
      const orgId   = req.user!.organizationId!
      // CLIENT видит только свои заказы
      if (req.user!.role === 'CLIENT') {
        const client = await import('../../infrastructure/db/prisma').then(m =>
          m.prisma.client.findUnique({ where: { userId: req.user!.sub } })
        )
        if (client) filters.clientId = client.id
      }
      res.json(ok(await orderService.list(orgId, filters)))
    } catch (e) { next(e) }
  },
)

// Получить заказ по ID
ordersRouter.get(
  '/:id',
  authenticate,
  authorize('ADMIN', 'ORG_ADMIN', 'SUPERVISOR', 'CLIENT', 'COURIER'),
  async (req, res, next) => {
    try {
      res.json(ok(await orderService.getById(req.params.id, req.user!.organizationId!)))
    } catch (e) { next(e) }
  },
)

// Обновить статус — COURIER, SUPERVISOR, ORG_ADMIN
ordersRouter.patch(
  '/:id/status',
  authenticate,
  authorize('COURIER', 'SUPERVISOR', 'ORG_ADMIN', 'ADMIN'),
  validate(UpdateOrderStatusSchema),
  async (req, res, next) => {
    try {
      res.json(ok(await orderService.updateStatus(
        req.params.id,
        req.user!.organizationId!,
        req.body,
        req.user!.sub,
      )))
    } catch (e) { next(e) }
  },
)

// Назначить курьера вручную — SUPERVISOR, ORG_ADMIN
ordersRouter.patch(
  '/:id/assign',
  authenticate,
  authorize('SUPERVISOR', 'ORG_ADMIN', 'ADMIN'),
  validate(AssignOrderSchema),
  async (req, res, next) => {
    try {
      res.json(ok(await orderService.assign(
        req.params.id,
        req.user!.organizationId!,
        req.body.courierId,
        req.user!.sub,
      )))
    } catch (e) { next(e) }
  },
)

// Отменить заказ — CLIENT, SUPERVISOR, ORG_ADMIN
ordersRouter.patch(
  '/:id/cancel',
  authenticate,
  authorize('CLIENT', 'SUPERVISOR', 'ORG_ADMIN', 'ADMIN'),
  async (req, res, next) => {
    try {
      res.json(ok(await orderService.cancel(
        req.params.id,
        req.user!.organizationId!,
        req.user!.sub,
        req.body.comment,
      )))
    } catch (e) { next(e) }
  },
)
