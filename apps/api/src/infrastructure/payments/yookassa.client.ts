import crypto from 'crypto'

const YOOKASSA_BASE = 'https://api.yookassa.ru/v3'

// Платформенные реквизиты (из .env) — для создания платежей от имени платформы-агента
const PLATFORM_SHOP_ID  = process.env.YOOKASSA_SHOP_ID!
const PLATFORM_SECRET   = process.env.YOOKASSA_SECRET_KEY!

export interface YooKassaPaymentRequest {
  amount:       { value: string; currency: 'RUB' }
  payment_method_data?: { type: 'bank_card' | 'sbp' | 'sberbank' | 'yoo_money' }
  confirmation: { type: 'redirect'; return_url: string }
  capture?:     boolean
  description?: string
  metadata?:    Record<string, string>
  receipt?:     YooKassaReceipt
  // Для агентской схемы — реквизиты принципала (B2B клиент)
  transfers?: Array<{
    account_id:  string   // shopId принципала в YooKassa
    amount:      { value: string; currency: 'RUB' }
    description?: string
  }>
}

export interface YooKassaReceipt {
  customer: { phone?: string; email?: string }
  items: Array<{
    description: string
    quantity:    string
    amount:      { value: string; currency: 'RUB' }
    vat_code:    1 | 2 | 3 | 4 | 5 | 6   // 1=без НДС, 2=0%, 6=20%
    payment_subject: 'service' | 'commodity'
    payment_mode:    'full_payment' | 'advance'
  }>
  tax_system_code?: 1 | 2 | 3 | 4 | 5 | 6  // 1=ОСН, 2=УСН доходы
}

export interface YooKassaPayment {
  id:           string
  status:       'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled'
  amount:       { value: string; currency: string }
  confirmation: { type: string; confirmation_url?: string }
  created_at:   string
  captured_at?: string
  description?: string
  metadata?:    Record<string, string>
  income_amount?: { value: string; currency: string }
}

export interface YooKassaWebhookEvent {
  type:   'notification'
  event:  'payment.succeeded' | 'payment.canceled' | 'payment.waiting_for_capture' | 'refund.succeeded'
  object: YooKassaPayment
}

function authHeader(shopId: string, secretKey: string): string {
  return 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64')
}

async function request<T>(
  method: string,
  path:   string,
  body?:  unknown,
  shopId  = PLATFORM_SHOP_ID,
  secret  = PLATFORM_SECRET,
): Promise<T> {
  const idempotenceKey = crypto.randomUUID()
  const res = await fetch(`${YOOKASSA_BASE}${path}`, {
    method,
    headers: {
      'Authorization':    authHeader(shopId, secret),
      'Content-Type':     'application/json',
      'Idempotence-Key':  idempotenceKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw Object.assign(new Error(`YooKassa ${res.status}: ${JSON.stringify(data)}`), { status: res.status, data })
  return data as T
}

export const yookassaClient = {
  // Создать платёж (capture=false → двухстадийный, нужно подтвердить)
  async createPayment(params: YooKassaPaymentRequest, shopId?: string, secret?: string): Promise<YooKassaPayment> {
    return request('POST', '/payments', params, shopId, secret)
  },

  // Подтвердить удержание (capture двухстадийного платежа)
  async capturePayment(paymentId: string, amount: { value: string; currency: 'RUB' }, shopId?: string, secret?: string): Promise<YooKassaPayment> {
    return request('POST', `/payments/${paymentId}/capture`, { amount }, shopId, secret)
  },

  // Отменить платёж
  async cancelPayment(paymentId: string, shopId?: string, secret?: string): Promise<YooKassaPayment> {
    return request('POST', `/payments/${paymentId}/cancel`, {}, shopId, secret)
  },

  // Возврат платежа
  async createRefund(paymentId: string, amount: { value: string; currency: 'RUB' }, shopId?: string, secret?: string) {
    return request('POST', '/refunds', { payment_id: paymentId, amount }, shopId, secret)
  },

  // Получить статус платежа
  async getPayment(paymentId: string, shopId?: string, secret?: string): Promise<YooKassaPayment> {
    return request('GET', `/payments/${paymentId}`, undefined, shopId, secret)
  },

  // Верифицировать webhook подпись (SHA-256 HMAC)
  verifyWebhookSignature(body: string, signature: string, secret = PLATFORM_SECRET): boolean {
    const hmac = crypto.createHmac('sha256', secret).update(body).digest('hex')
    try { return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(signature)) } catch { return false }
  },

  // Сформировать чек 54-ФЗ для услуги доставки
  buildDeliveryReceipt(params: {
    phone:          string
    deliveryAmount: number
    orderNumber:    string
    vatCode?:       1 | 2 | 3 | 4 | 5 | 6
  }): YooKassaReceipt {
    return {
      customer: { phone: params.phone },
      items: [{
        description:     `Доставка заказа №${params.orderNumber}`,
        quantity:        '1.00',
        amount:          { value: params.deliveryAmount.toFixed(2), currency: 'RUB' },
        vat_code:        params.vatCode ?? 1,  // по умолчанию без НДС (агент на УСН)
        payment_subject: 'service',
        payment_mode:    'full_payment',
      }],
      tax_system_code: 2,  // УСН доходы — типично для агента
    }
  },
}
