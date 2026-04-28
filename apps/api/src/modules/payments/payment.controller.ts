import { Router, Request, Response, NextFunction } from 'express'
import { paymentService } from './payment.service'
import { agentReportService } from './agent-report.service'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { ok } from '@delivery/shared'
import { z } from 'zod'
import { PaymentStatus } from '@prisma/client'

export const paymentsRouter: Router = Router()

// POST /payments — инициировать оплату доставки
paymentsRouter.post(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = z.object({
        orderId:     z.string().uuid(),
        amount:      z.number().positive(),
        description: z.string().optional(),
        returnUrl:   z.string().url().optional(),
      }).parse(req.body)
      res.status(201).json(ok(await paymentService.initiatePayment({
        orderId:        body.orderId,
        amount:         body.amount,
        description:    body.description,
        returnUrl:      body.returnUrl,
        organizationId: req.user!.organizationId!,
      })))
    } catch (e) { next(e) }
  },
)

// GET /payments — список платежей
paymentsRouter.get(
  '/',
  authenticate, authorize('ADMIN', 'ORG_ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters = {
        status: req.query.status as PaymentStatus | undefined,
        from:   req.query.from ? new Date(req.query.from as string) : undefined,
        to:     req.query.to   ? new Date(req.query.to   as string) : undefined,
        page:   Number(req.query.page  ?? 1),
        limit:  Number(req.query.limit ?? 50),
      }
      res.json(ok(await paymentService.listPayments(req.user!.organizationId!, filters)))
    } catch (e) { next(e) }
  },
)

// GET /payments/summary — сводка для дашборда
paymentsRouter.get(
  '/summary',
  authenticate, authorize('ADMIN', 'ORG_ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const from = req.query.from ? new Date(req.query.from as string) : new Date(new Date().setDate(1))
      const to   = req.query.to   ? new Date(req.query.to   as string) : new Date()
      res.json(ok(await agentReportService.summary(req.user!.organizationId!, from, to)))
    } catch (e) { next(e) }
  },
)

// GET /payments/:id
paymentsRouter.get(
  '/:id',
  authenticate, authorize('ADMIN', 'ORG_ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(ok(await paymentService.getPayment(req.params.id, req.user!.organizationId!)))
    } catch (e) { next(e) }
  },
)

// POST /payments/:id/refund — возврат
paymentsRouter.post(
  '/:id/refund',
  authenticate, authorize('ADMIN', 'ORG_ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { amount } = z.object({ amount: z.number().positive().optional() }).parse(req.body)
      res.json(ok(await paymentService.refundPayment(req.params.id, req.user!.organizationId!, amount)))
    } catch (e) { next(e) }
  },
)

// POST /payments/webhook — YooKassa webhook (без аутентификации, подпись проверяется внутри)
paymentsRouter.post(
  '/webhook',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Нужно получить raw body для проверки подписи
      const rawBody  = JSON.stringify(req.body)
      const signature = req.headers['x-idempotence-key'] as string ?? ''
      await paymentService.handleWebhook(rawBody, signature)
      res.json({ ok: true })
    } catch (e) { next(e) }
  },
)

// ── Отчёты агента ─────────────────────────────────────────────────────────────

// POST /payments/agent-reports — сформировать отчёт
paymentsRouter.post(
  '/agent-reports',
  authenticate, authorize('ADMIN', 'ORG_ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { periodStart, periodEnd } = z.object({
        periodStart: z.coerce.date(),
        periodEnd:   z.coerce.date(),
      }).parse(req.body)
      res.status(201).json(ok(await agentReportService.generate(req.user!.organizationId!, periodStart, periodEnd)))
    } catch (e) { next(e) }
  },
)

// GET /payments/agent-reports — список отчётов
paymentsRouter.get(
  '/agent-reports',
  authenticate, authorize('ADMIN', 'ORG_ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(ok(await agentReportService.list(req.user!.organizationId!)))
    } catch (e) { next(e) }
  },
)

// GET /payments/agent-reports/:id — детали отчёта
paymentsRouter.get(
  '/agent-reports/:id',
  authenticate, authorize('ADMIN', 'ORG_ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(ok(await agentReportService.get(req.params.id, req.user!.organizationId!)))
    } catch (e) { next(e) }
  },
)

// GET /payments/agent-reports/:id/csv — скачать CSV для бухгалтерии
paymentsRouter.get(
  '/agent-reports/:id/csv',
  authenticate, authorize('ADMIN', 'ORG_ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const csv = await agentReportService.exportCsv(req.params.id, req.user!.organizationId!)
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="agent-report-${req.params.id}.csv"`)
      res.send('﻿' + csv)  // BOM для корректного открытия в Excel
    } catch (e) { next(e) }
  },
)

// PATCH /payments/agent-reports/:id/sent — отметить отчёт как отправленный
paymentsRouter.patch(
  '/agent-reports/:id/sent',
  authenticate, authorize('ADMIN', 'ORG_ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(ok(await agentReportService.markSent(req.params.id, req.user!.organizationId!)))
    } catch (e) { next(e) }
  },
)
