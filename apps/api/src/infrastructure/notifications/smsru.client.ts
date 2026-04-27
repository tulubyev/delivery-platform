const API_ID  = process.env.SMSRU_API_ID!
const BASE    = 'https://sms.ru/sms/send'

export interface SmsResult {
  status:    'OK' | 'ERROR'
  sms_id?:  string
  status_code?: number
  status_text?: string
}

export const smsruClient = {
  async send(to: string, message: string): Promise<SmsResult> {
    // Нормализуем номер: +7... → 7...
    const phone = to.replace(/\D/g, '').replace(/^8/, '7')
    const url   = new URL(BASE)
    url.searchParams.set('api_id',  API_ID)
    url.searchParams.set('to',      phone)
    url.searchParams.set('msg',     message)
    url.searchParams.set('json',    '1')
    url.searchParams.set('from',    process.env.SMSRU_SENDER ?? 'Delivery')

    const res  = await fetch(url.toString())
    const data = await res.json() as { status: string; sms?: Record<string, { status: string; status_code: number; status_text: string; sms_id?: string }> }

    if (data.status !== 'OK') {
      return { status: 'ERROR', status_text: data.status }
    }

    // sms.ru возвращает результат по номеру
    const smsEntry = data.sms ? Object.values(data.sms)[0] : undefined
    if (!smsEntry || smsEntry.status !== 'OK') {
      return { status: 'ERROR', status_code: smsEntry?.status_code, status_text: smsEntry?.status_text }
    }

    return { status: 'OK', sms_id: smsEntry.sms_id }
  },

  async checkBalance(): Promise<number> {
    const url = `https://sms.ru/my/balance?api_id=${API_ID}&json=1`
    const res  = await fetch(url)
    const data = await res.json() as { balance?: number }
    return data.balance ?? 0
  },
}
