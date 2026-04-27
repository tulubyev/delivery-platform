// Expo Push API — работает в РФ, не требует Firebase
// Expo выступает прокси между APNs (iOS) и FCM (Android)
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

export interface ExpoPushMessage {
  to:       string   // ExponentPushToken[xxx]
  title?:   string
  body:     string
  data?:    Record<string, unknown>
  sound?:   'default' | null
  badge?:   number
  priority?: 'default' | 'normal' | 'high'
}

export interface ExpoPushTicket {
  status:  'ok' | 'error'
  id?:     string
  message?: string
  details?: { error?: string }
}

export const expoPushClient = {
  async send(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
    if (!messages.length) return []

    // Expo принимает батчи до 100 сообщений
    const batches = chunk(messages, 100)
    const results: ExpoPushTicket[] = []

    for (const batch of batches) {
      const res  = await fetch(EXPO_PUSH_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Accept-Encoding': 'gzip, deflate' },
        body:    JSON.stringify(batch),
      })
      const data = await res.json() as { data: ExpoPushTicket[] }
      results.push(...data.data)
    }

    return results
  },

  async sendOne(token: string, title: string, body: string, data?: Record<string, unknown>): Promise<ExpoPushTicket> {
    const [ticket] = await this.send([{ to: token, title, body, data, sound: 'default', priority: 'high' }])
    return ticket
  },
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size))
  return result
}
