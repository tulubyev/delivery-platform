// Aptogon gesture-CAPTCHA — серверная верификация одноразового токена.
// Контракт: POST https://homosapience.org/api/captcha/siteverify
//   Authorization: Bearer sk_live_…   body: { token }
//   200 { success: true, human: true, ... } → пропускать
//   409 — токен уже использован (повторная проверка)
// Секрет только на сервере (APTOGON_SECRET_KEY), в клиент не передаётся.

const VERIFY_URL = 'https://homosapience.org/api/captcha/siteverify'

export interface CaptchaCheck { ok: boolean; reason?: string }

/** Капча включена, если задан секрет и явно не выключена флагом. */
export function captchaEnabled(): boolean {
  return !!process.env.APTOGON_SECRET_KEY && process.env.CAPTCHA_ENABLED !== 'false'
}

/** Короткая безопасная выжимка ответа siteverify для лога.
 *  Сырое тело логировать нельзя: при ошибке валидации (422) провайдер возвращает
 *  в `detail[].input` присланные данные, то есть сам токен. */
function summarize(data: unknown): string {
  if (!data || typeof data !== 'object') return 'no-body'
  const d = data as Record<string, unknown>
  const parts: string[] = []
  for (const k of ['success', 'human', 'band', 'error', 'error_code', 'message']) {
    const v = d[k]
    if (v !== undefined && ['string', 'number', 'boolean'].includes(typeof v)) parts.push(`${k}=${String(v).slice(0, 80)}`)
  }
  if (Array.isArray(d.detail)) {
    const items = (d.detail as Array<Record<string, unknown>>).slice(0, 3)
      .map(i => `${i?.type ?? '?'}@${Array.isArray(i?.loc) ? (i.loc as unknown[]).join('.') : '?'}`)
    parts.push(`detail=[${items.join(',')}]`)
  } else if (typeof d.detail === 'string') {
    parts.push(`detail=${d.detail.slice(0, 80)}`)
  }
  parts.push(`keys=${Object.keys(d).slice(0, 8).join('|')}`)
  return parts.join(' ')
}

/** Причина отказа в журнал: без токена, секрета и данных пользователя. */
function logReject(reason: string, extra: string, started: number) {
  console.warn(`[captcha] rejected reason=${reason} ${extra} ms=${Date.now() - started}`.replace(/\s+/g, ' ').trim())
}

export async function verifyCaptcha(token: string | undefined): Promise<CaptchaCheck> {
  const started = Date.now()
  const secret = process.env.APTOGON_SECRET_KEY
  if (!secret) return { ok: true } // капча не настроена — не блокируем вход
  if (!token) {
    logReject('missing', 'hint=клиент не прислал captchaToken', started)
    return { ok: false, reason: 'missing' }
  }

  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ token }),
    })

    // Тело читаем один раз и безопасно: оно может быть не JSON (HTML ошибки прокси и т.п.)
    const data: unknown = await res.json().catch(() => undefined)

    if (res.status === 409) {
      logReject('reused', `http=409 ${summarize(data)}`, started)
      return { ok: false, reason: 'reused' }
    }
    if (!res.ok) {
      logReject(`http_${res.status}`, summarize(data), started)
      return { ok: false, reason: `http_${res.status}` }
    }

    const body = (data ?? {}) as { success?: boolean; human?: boolean }
    // Пропускаем только при success=true и не-робот (human !== false)
    if (body.success && body.human !== false) return { ok: true }
    logReject('failed', `http=${res.status} ${summarize(data)}`, started)
    return { ok: false, reason: 'failed' }
  } catch (err) {
    // Сеть/провайдер недоступны — fail-closed (безопаснее для гейта входа)
    logReject('unreachable', `error=${(err as Error).message}`, started)
    return { ok: false, reason: 'unreachable' }
  }
}
