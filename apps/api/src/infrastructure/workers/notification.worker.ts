import { Worker } from 'bullmq'
import { createRedisConnection } from '../redis/redis'
import { QUEUE_NAMES, NotificationJobData } from '../queue/queues'
import { expoPushClient } from '../notifications/expo-push.client'
import { smsruClient } from '../notifications/smsru.client'
import { prisma } from '../db/prisma'
import { ContactChannel, ContactStatus } from '@prisma/client'

export function startNotificationWorker() {
  const worker = new Worker(
    QUEUE_NAMES.NOTIFICATIONS,
    async (job) => {
      const data = job.data as NotificationJobData

      if (data.channel === 'PUSH') {
        // Expo Push — для курьеров
        const courier = await prisma.courier.findFirst({
          where:  { userId: data.userId },
          select: { expoPushToken: true },
        })
        if (!courier?.expoPushToken) return

        const ticket = await expoPushClient.sendOne(courier.expoPushToken, data.title, data.body, data.data)
        if (ticket.status === 'error') console.error('[NotifWorker] Expo error:', ticket.message)

      } else if (data.channel === 'SMS') {
        // SMS через SMS.ru — для получателей
        if (!data.phone) { console.warn('[NotifWorker] SMS job missing phone'); return }
        const result = await smsruClient.send(data.phone, data.body)

        if (data.orderId) {
          await prisma.recipientContact.create({
            data: {
              orderId:    data.orderId,
              channel:    ContactChannel.SMS,
              direction:  'OUTBOUND',
              status:     result.status === 'OK' ? ContactStatus.SENT : ContactStatus.FAILED,
              body:       data.body,
              externalId: result.sms_id,
            },
          })
        }

      } else if (data.channel === 'IN_APP') {
        // Уведомление в приложении через WS (импортируем лениво во избежание circular)
        const { wsManager } = await import('../../modules/ws/ws.manager')
        wsManager.broadcast(`user:${data.userId}`, { type: 'NOTIFICATION', payload: { title: data.title, body: data.body, data: data.data } })
      }
    },
    { connection: createRedisConnection(), concurrency: 10 },
  )

  worker.on('failed', (_job, err) => console.error('[NotifWorker] failed:', err.message))
  console.log('✅ NotificationWorker started')
  return worker
}
