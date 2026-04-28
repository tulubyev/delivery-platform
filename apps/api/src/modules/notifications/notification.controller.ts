import { Router, Request, Response, NextFunction } from 'express'
import { notificationService } from './notification.service'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { ok } from '@delivery/shared'
import { z } from 'zod'
import { ContactChannel, NotifyEvent } from '@prisma/client'

export const notificationsRouter: Router = Router()

// GET /vapid-public-key — клиент получает ключ для регистрации Web Push подписки
notificationsRouter.get('/vapid-public-key', (_req, res) => {
  res.json(ok({ publicKey: notificationService.getVapidPublicKey() }))
})

// POST /web-push/subscribe — сохранить подписку браузера
notificationsRouter.post(
  '/web-push/subscribe',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sub = z.object({
        endpoint: z.string().url(),
        keys:     z.object({ p256dh: z.string(), auth: z.string() }),
      }).parse(req.body)
      await notificationService.saveWebSubscription(req.user!.sub, sub as { endpoint: string; keys: { p256dh: string; auth: string } })
      res.json(ok({ subscribed: true }))
    } catch (e) { next(e) }
  },
)

// GET /templates — список шаблонов организации
notificationsRouter.get(
  '/templates',
  authenticate,
  authorize('ADMIN', 'ORG_ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(ok(await notificationService.listTemplates(req.user!.organizationId!)))
    } catch (e) { next(e) }
  },
)

// PUT /templates — создать/обновить шаблон
notificationsRouter.put(
  '/templates',
  authenticate,
  authorize('ADMIN', 'ORG_ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = z.object({
        event:    z.nativeEnum(NotifyEvent),
        channel:  z.nativeEnum(ContactChannel),
        template: z.string().min(1),
      }).parse(req.body)
      res.json(ok(await notificationService.upsertTemplate(req.user!.organizationId!, body.event, body.channel, body.template)))
    } catch (e) { next(e) }
  },
)

// GET /orders/:orderId/contacts — история контактов с получателем
notificationsRouter.get(
  '/orders/:orderId/contacts',
  authenticate,
  authorize('ADMIN', 'ORG_ADMIN', 'SUPERVISOR'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(ok(await notificationService.getContactHistory(req.params.orderId)))
    } catch (e) { next(e) }
  },
)

// POST /couriers/:courierId/push — тестовый push курьеру (для отладки)
notificationsRouter.post(
  '/couriers/:courierId/push',
  authenticate,
  authorize('ADMIN', 'ORG_ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, body } = z.object({ title: z.string(), body: z.string() }).parse(req.body)
      await notificationService.pushToCourier(req.params.courierId, title, body)
      res.json(ok({ sent: true }))
    } catch (e) { next(e) }
  },
)
