import { Router } from 'express'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { ok } from '@delivery/shared'
import { dispatchService } from './dispatch.service'
import { prisma } from '../../infrastructure/db/prisma'

export const dispatchRouter: Router = Router()

// Курьер: список доступных заказов в конкурентном пуле
dispatchRouter.get(
  '/pool',
  authenticate,
  authorize('COURIER'),
  async (req, res, next) => {
    try {
      const courier = await prisma.courier.findUnique({ where: { userId: req.user!.sub } })
      if (!courier) return res.status(404).json({ success: false, error: 'Профиль курьера не найден' })
      // Берём заказы из всех зон организации (курьер сам фильтрует по расположению)
      const zones = await prisma.zone.findMany({
        where:  { organizationId: req.user!.organizationId!, isActive: true },
        select: { id: true },
      })
      const results = await Promise.all(
        zones.map(z => dispatchService.getPoolOrders(req.user!.organizationId!, z.id)),
      )
      res.json(ok(results.flat()))
    } catch (e) { next(e) }
  },
)

// Курьер: принять оффер
dispatchRouter.post(
  '/offers/:offerId/accept',
  authenticate,
  authorize('COURIER'),
  async (req, res, next) => {
    try {
      const courier = await prisma.courier.findUnique({ where: { userId: req.user!.sub } })
      if (!courier) return res.status(404).json({ success: false, error: 'Профиль курьера не найден' })
      const accepted = await dispatchService.acceptOffer(req.params.offerId, courier.id)
      if (!accepted) return res.status(409).json({ success: false, error: 'Заказ уже назначен другому курьеру или оффер истёк' })
      res.json(ok({ accepted: true }))
    } catch (e) { next(e) }
  },
)

// Курьер: отклонить оффер
dispatchRouter.post(
  '/offers/:offerId/decline',
  authenticate,
  authorize('COURIER'),
  async (req, res, next) => {
    try {
      const courier = await prisma.courier.findUnique({ where: { userId: req.user!.sub } })
      if (!courier) return res.status(404).json({ success: false, error: 'Профиль курьера не найден' })
      await dispatchService.declineOffer(req.params.offerId, courier.id)
      res.json(ok({ declined: true }))
    } catch (e) { next(e) }
  },
)
