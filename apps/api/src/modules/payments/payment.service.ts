import { PaymentStatus } from '@prisma/client'
import { prisma } from '../../infrastructure/db/prisma'
import { yookassaClient, YooKassaWebhookEvent } from '../../infrastructure/payments/yookassa.client'
import { encryptionService } from '../../infrastructure/encryption/encryption.service'

const BASE_URL = process.env.APP_BASE_URL ?? 'https://delivery.app'

export const paymentService = {
  // Инициировать платёж за доставку (получатель оплачивает онлайн)
  async initiatePayment(params: {
    orderId:        string
    organizationId: string
    amount:         number
    description?:   string
    returnUrl?:     string
  }) {
    const { orderId, organizationId, amount, description, returnUrl } = params

    // Получаем конфиг организации (shopId принципала + комиссия платформы)
    const cfg = await prisma.tenantConfig.findUnique({ where: { organizationId } })
    const commissionPct   = cfg?.agentCommissionPct ?? 5.0
    const commissionAmt   = Math.round(amount * commissionPct) / 100
    const principalAmt    = amount - commissionAmt

    // Получаем данные заказа для чека
    const order = await prisma.order.findUnique({
      where:  { id: orderId },
      select: { number: true, recipientPhoneEnc: true },
    })
    if (!order) throw Object.assign(new Error('Order not found'), { status: 404 })

    const recipientPhone = encryptionService.decrypt(order.recipientPhoneEnc)
    const receipt        = yookassaClient.buildDeliveryReceipt({
      phone:          recipientPhone,
      deliveryAmount: amount,
      orderNumber:    order.number,
    })

    // Transfers — перевод принципалу (если у организации настроен shopId)
    const transfers = cfg?.yookassaShopId ? [{
      account_id:  cfg.yookassaShopId,
      amount:      { value: principalAmt.toFixed(2), currency: 'RUB' as const },
      description: `Доставка заказа №${order.number}`,
    }] : undefined

    const ykPayment = await yookassaClient.createPayment({
      amount:              { value: amount.toFixed(2), currency: 'RUB' },
      payment_method_data: { type: 'bank_card' },
      confirmation:        { type: 'redirect', return_url: returnUrl ?? `${BASE_URL}/track` },
      capture:             true,
      description:         description ?? `Доставка заказа №${order.number}`,
      receipt,
      transfers,
      metadata:            { orderId, organizationId },
    })

    // Сохраняем платёж в БД
    const payment = await prisma.payment.create({
      data: {
        organizationId,
        orderId,
        yookassaId:     ykPayment.id,
        amount,
        commissionAmount: commissionAmt,
        principalAmount:  principalAmt,
        status:          PaymentStatus.PENDING,
        description:     description ?? `Доставка заказа №${order.number}`,
        metadata:        { commissionPct },
      },
    })

    return {
      paymentId:       payment.id,
      yookassaId:      ykPayment.id,
      confirmationUrl: ykPayment.confirmation.confirmation_url,
      amount,
      commissionAmt,
      principalAmt,
    }
  },

  // Обработка webhook от YooKassa
  async handleWebhook(rawBody: string, signature: string) {
    if (!yookassaClient.verifyWebhookSignature(rawBody, signature)) {
      throw Object.assign(new Error('Invalid webhook signature'), { status: 401 })
    }

    const event: YooKassaWebhookEvent = JSON.parse(rawBody)
    const ykPayment = event.object

    const payment = await prisma.payment.findUnique({ where: { yookassaId: ykPayment.id } })
    if (!payment) return  // платёж не из нашей системы

    if (event.event === 'payment.succeeded') {
      await prisma.payment.update({
        where: { id: payment.id },
        data:  { status: PaymentStatus.SUCCEEDED, capturedAt: new Date(), receiptSent: true },
      })
      // Уведомляем через WS что оплата прошла
      const { wsManager } = await import('../ws/ws.manager')
      wsManager.broadcast(`order:${payment.orderId}`, { type: 'PAYMENT_SUCCEEDED', payload: { orderId: payment.orderId } })

    } else if (event.event === 'payment.canceled') {
      await prisma.payment.update({
        where: { id: payment.id },
        data:  { status: PaymentStatus.CANCELLED, cancelledAt: new Date() },
      })

    } else if (event.event === 'payment.waiting_for_capture') {
      await prisma.payment.update({
        where: { id: payment.id },
        data:  { status: PaymentStatus.WAITING_FOR_CAPTURE },
      })

    } else if (event.event === 'refund.succeeded') {
      await prisma.payment.update({
        where: { id: payment.id },
        data:  { status: PaymentStatus.REFUNDED },
      })
    }
  },

  // Возврат платежа
  async refundPayment(paymentId: string, organizationId: string, amount?: number) {
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, organizationId, status: PaymentStatus.SUCCEEDED },
    })
    if (!payment?.yookassaId) throw Object.assign(new Error('Payment not found or not refundable'), { status: 404 })

    const refundAmount = amount ?? payment.amount
    const refund = await yookassaClient.createRefund(payment.yookassaId, {
      value: refundAmount.toFixed(2), currency: 'RUB',
    })

    await prisma.payment.update({
      where: { id: paymentId },
      data:  { status: PaymentStatus.REFUNDED, refundId: (refund as { id: string }).id },
    })
    return refund
  },

  async listPayments(orgId: string, filters: { status?: PaymentStatus; from?: Date; to?: Date; page?: number; limit?: number }) {
    const { status, from, to, page = 1, limit = 50 } = filters
    const where = {
      organizationId: orgId,
      ...(status ? { status } : {}),
      ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    }
    const [items, total] = await Promise.all([
      prisma.payment.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.payment.count({ where }),
    ])
    return { items, total, page, limit }
  },

  async getPayment(id: string, orgId: string) {
    const p = await prisma.payment.findFirst({ where: { id, organizationId: orgId } })
    if (!p) throw Object.assign(new Error('Payment not found'), { status: 404 })
    return p
  },
}
