import webpush from 'web-push'

// VAPID ключи генерируются один раз: npx web-push generate-vapid-keys
// Хранить в .env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
let initialized = false

function init() {
  if (initialized) return
  const pub  = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) { console.warn('[WebPush] VAPID keys not set — web push disabled'); return }
  webpush.setVapidDetails(`mailto:${process.env.VAPID_EMAIL ?? 'admin@delivery.app'}`, pub, priv)
  initialized = true
}

export interface PushSubscription {
  endpoint: string
  keys:     { p256dh: string; auth: string }
}

export const webPushClient = {
  getPublicKey(): string {
    return process.env.VAPID_PUBLIC_KEY ?? ''
  },

  async send(subscription: PushSubscription, payload: { title: string; body: string; data?: unknown }): Promise<boolean> {
    init()
    if (!initialized) return false
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload))
      return true
    } catch (err: unknown) {
      // 410 Gone — подписка устарела, нужно удалить
      if ((err as { statusCode?: number }).statusCode === 410) return false
      console.error('[WebPush] send error:', (err as Error).message)
      return false
    }
  },
}
