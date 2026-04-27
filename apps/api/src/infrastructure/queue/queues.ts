import { Queue } from 'bullmq'
import { createRedisConnection } from '../redis/redis'

export const QUEUE_NAMES = {
  DISPATCH:       'dispatch',
  DISPATCH_OFFER: 'dispatch-offer',
  NOTIFICATIONS:  'notifications',
  ETA_CALC:       'eta-calculation',
  PAYOUT_CALC:    'payout-calculation',
  WEBHOOK:        'webhook-delivery',
  ALERT:          'alert-check',
  ROUTE_BUILD:    'route-build',
} as const

const defaultOpts = { attempts: 3, backoff: { type: 'exponential' as const, delay: 2000 }, removeOnComplete: 100, removeOnFail: 200 }
const conn = () => createRedisConnection()

export const dispatchQueue      = new Queue(QUEUE_NAMES.DISPATCH,       { connection: conn(), defaultJobOptions: { ...defaultOpts, attempts: 5 } })
export const dispatchOfferQueue = new Queue(QUEUE_NAMES.DISPATCH_OFFER, { connection: conn(), defaultJobOptions: defaultOpts })
export const notificationQueue  = new Queue(QUEUE_NAMES.NOTIFICATIONS,  { connection: conn(), defaultJobOptions: defaultOpts })
export const etaQueue           = new Queue(QUEUE_NAMES.ETA_CALC,       { connection: conn() })
export const payoutQueue        = new Queue(QUEUE_NAMES.PAYOUT_CALC,    { connection: conn() })
export const webhookQueue       = new Queue(QUEUE_NAMES.WEBHOOK,        { connection: conn(), defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 1000 } } })
export const alertQueue         = new Queue(QUEUE_NAMES.ALERT,          { connection: conn() })
export const routeQueue         = new Queue(QUEUE_NAMES.ROUTE_BUILD,    { connection: conn(), defaultJobOptions: defaultOpts })

// ── Job data types ────────────────────────────────────────────────────────────

export interface DispatchJobData {
  orderId:        string
  organizationId: string
  attempt:        number   // номер попытки (макс. 3 для AUTO)
}

export interface DispatchOfferJobData {
  offerId:   string
  orderId:   string
  courierId: string
}

export interface NotificationJobData {
  userId:  string
  type:    string
  title:   string
  body:    string
  channel: 'PUSH' | 'SMS' | 'IN_APP'
  data?:   Record<string, unknown>
}

export interface WebhookJobData {
  clientId:   string
  webhookUrl: string
  event:      string
  payload:    Record<string, unknown>
}
