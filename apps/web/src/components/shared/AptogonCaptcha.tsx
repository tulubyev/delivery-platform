import { useEffect, useRef } from 'react'

// Aptogon gesture-CAPTCHA (homosapience.org). Публичный ключ безопасно на клиенте.
const SCRIPT_SRC = 'https://homosapience.org/embed/v2/aptogon.js'
const PUBLIC_KEY  = import.meta.env.VITE_APTOGON_KEY ?? 'pk_live_iFFwvx5yRI4_VtmxARcr-OZIsJ58dFL3'

declare global {
  interface Window {
    AptogonCaptcha?: {
      render: (el: HTMLElement, opts: {
        key: string
        onVerified?: (token: string, meta?: { human?: boolean; band?: string }) => void
        onError?: (err?: unknown) => void
      }) => void
    }
  }
}

let scriptPromise: Promise<void> | null = null
function loadScript(): Promise<void> {
  if (window.AptogonCaptcha) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
    if (existing) { existing.addEventListener('load', () => resolve()); return }
    const s = document.createElement('script')
    s.src = SCRIPT_SRC
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Не удалось загрузить капчу'))
    document.head.appendChild(s)
  })
  return scriptPromise
}

interface Props {
  onVerified: (token: string) => void
  onError?: () => void
}

export function AptogonCaptcha({ onVerified, onError }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const rendered = useRef(false)

  useEffect(() => {
    let cancelled = false
    loadScript()
      .then(() => {
        if (cancelled || rendered.current || !ref.current || !window.AptogonCaptcha) return
        rendered.current = true
        window.AptogonCaptcha.render(ref.current, {
          key: PUBLIC_KEY,
          onVerified: (token) => onVerified(token),
          onError: () => onError?.(),
        })
      })
      .catch(() => onError?.())
    return () => { cancelled = true }
    // Рендерим один раз при монтировании
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={ref} data-aptogon-captcha data-aptogon-key={PUBLIC_KEY} className="flex justify-center min-h-[78px]" />
}
