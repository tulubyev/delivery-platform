import { ContactChannel, ContactStatus, NotifyEvent } from '@prisma/client'
import { prisma } from '../../infrastructure/db/prisma'
import { smsruClient } from '../../infrastructure/notifications/smsru.client'
import { expoPushClient } from '../../infrastructure/notifications/expo-push.client'
import { webPushClient, PushSubscription } from '../../infrastructure/notifications/webpush.client'
import { encryptionService } from '../../infrastructure/encryption/encryption.service'

// ─── Шаблонизатор ────────────────────────────────────────────────────────────

function renderTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`))
}

// ─── Получение шаблона организации ───────────────────────────────────────────

async function getTemplate(orgId: string, event: NotifyEvent, channel: ContactChannel): Promise<string | null> {
  const tpl = await prisma.notificationTemplate.findUnique({
    where:  { organizationId_event_channel: { organizationId: orgId, event, channel } },
    select: { template: true, isActive: true },
  })
  return tpl?.isActive ? tpl.template : null
}

// ─── Основной сервис ──────────────────────────────────────────────────────────

export const notificationService = {
  // Отправить SMS получателю заказа
  async sendOrderSms(params: {
    orderId:        string
    event:          NotifyEvent
    recipientPhone: string          // зашифрованный телефон из БД
    vars:           Record<string, string | number>
    organizationId: string
  }) {
    const { orderId, event, recipientPhone, vars, organizationId } = params

    const template = await getTemplate(organizationId, event, ContactChannel.SMS)
    if (!template) return  // шаблон не настроен — пропускаем

    const phone = encryptionService.decrypt(recipientPhone)
    const body  = renderTemplate(template, vars)

    const result = await smsruClient.send(phone, body)

    await prisma.recipientContact.create({
      data: {
        orderId,
        channel:    ContactChannel.SMS,
        direction:  'OUTBOUND',
        status:     result.status === 'OK' ? ContactStatus.SENT : ContactStatus.FAILED,
        body,
        externalId: result.sms_id,
      },
    })
  },

  // Push курьеру через Expo
  async pushToCourier(courierId: string, title: string, body: string, data?: Record<string, unknown>) {
    const courier = await prisma.courier.findUnique({
      where:  { id: courierId },
      select: { expoPushToken: true },
    })
    if (!courier?.expoPushToken) return

    const ticket = await expoPushClient.sendOne(courier.expoPushToken, title, body, data)
    if (ticket.status === 'error') {
      console.error(`[Push] Expo error for courier ${courierId}:`, ticket.message)
    }
  },

  // Batch push нескольким курьерам
  async pushToCouriers(courierIds: string[], title: string, body: string, data?: Record<string, unknown>) {
    const couriers = await prisma.courier.findMany({
      where:  { id: { in: courierIds }, expoPushToken: { not: null } },
      select: { expoPushToken: true },
    })
    const messages = couriers
      .filter(c => c.expoPushToken)
      .map(c => ({ to: c.expoPushToken!, title, body, data, sound: 'default' as const, priority: 'high' as const }))
    if (messages.length) await expoPushClient.send(messages)
  },

  // Web Push супервизору в браузер (алерты, события)
  async pushToWebSubscription(subscription: PushSubscription, title: string, body: string, data?: unknown) {
    return webPushClient.send(subscription, { title, body, data })
  },

  // Получить VAPID public key для регистрации подписки на клиенте
  getVapidPublicKey(): string {
    return webPushClient.getPublicKey()
  },

  // Сохранить Web Push подписку пользователя
  async saveWebSubscription(userId: string, subscription: PushSubscription) {
    await prisma.userPushSubscription.upsert({
      where:  { userId_endpoint: { userId, endpoint: subscription.endpoint } },
      update: { keys: subscription.keys as object, updatedAt: new Date() },
      create: { userId, endpoint: subscription.endpoint, keys: subscription.keys as object },
    })
  },

  // Разослать алерт всем супервизорам организации через Web Push
  async pushAlertToSupervisors(orgId: string, title: string, body: string, data?: unknown) {
    const subscriptions = await prisma.userPushSubscription.findMany({
      where: { user: { organizationId: orgId, role: { in: ['ORG_ADMIN', 'SUPERVISOR'] } } },
    })
    await Promise.allSettled(
      subscriptions.map(s =>
        webPushClient.send({ endpoint: s.endpoint, keys: s.keys as { p256dh: string; auth: string } }, { title, body, data })
      )
    )
  },

  // Управление шаблонами
  async upsertTemplate(orgId: string, event: NotifyEvent, channel: ContactChannel, template: string) {
    return prisma.notificationTemplate.upsert({
      where:  { organizationId_event_channel: { organizationId: orgId, event, channel } },
      update: { template, isActive: true },
      create: { organizationId: orgId, event, channel, template },
    })
  },

  async listTemplates(orgId: string) {
    return prisma.notificationTemplate.findMany({ where: { organizationId: orgId }, orderBy: { event: 'asc' } })
  },

  // История контактов по заказу
  async getContactHistory(orderId: string) {
    return prisma.recipientContact.findMany({
      where:   { orderId },
      orderBy: { createdAt: 'desc' },
    })
  },
}
