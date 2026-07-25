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

export async function verifyCaptcha(token: string | undefined): Promise<CaptchaCheck> {
  const secret = process.env.APTOGON_SECRET_KEY
  if (!secret) return { ok: true } // капча не настроена — не блокируем вход
  if (!token)  return { ok: false, reason: 'missing' }

  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ token }),
    })

    if (res.status === 409) return { ok: false, reason: 'reused' }
    if (!res.ok)            return { ok: false, reason: `http_${res.status}` }

    const data = await res.json() as { success?: boolean; human?: boolean }
    // Пропускаем только при success=true и не-робот (human !== false)
    if (data.success && data.human !== false) return { ok: true }
    return { ok: false, reason: 'failed' }
  } catch (err) {
    // Сеть/провайдер недоступны — fail-closed (безопаснее для гейта входа)
    console.error('[captcha] verify error:', (err as Error).message)
    return { ok: false, reason: 'unreachable' }
  }
}
