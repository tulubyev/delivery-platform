import { Queue } from 'bullmq'
import { createRedisConnection } from '../redis/redis'

export const QUEUE_NAMES = {
  NOTIFICATIONS: 'notifications',
  ETA_CALC: 'eta-calculation',
  PAYOUT_CALC: 'payout-calculation',
  WEBHOOK: 'webhook-delivery',
} as const

const conn = () => createRedisConnection()
export const notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATIONS, { connection: conn(), defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 100, removeOnFail: 200 } })
export const etaQueue = new Queue(QUEUE_NAMES.ETA_CALC, { connection: conn() })
export const payoutQueue = new Queue(QUEUE_NAMES.PAYOUT_CALC, { connection: conn() })
export const webhookQueue = new Queue(QUEUE_NAMES.WEBHOOK, { connection: conn(), defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 1000 } } })

export interface NotificationJobData { userId: string; type: string; title: string; body: string; channel: 'PUSH'|'SMS'|'IN_APP'; data?: Record<string, unknown> }
export interface WebhookJobData { clientId: string; webhookUrl: string; event: string; payload: Record<string, unknown> }
