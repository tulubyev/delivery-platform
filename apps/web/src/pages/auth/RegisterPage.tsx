import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Truck, Eye, EyeOff } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

const ROLE_REDIRECT: Record<string, string> = {
  ADMIN: '/admin', ORG_ADMIN: '/admin', SUPERVISOR: '/supervisor', CLIENT: '/client', COURIER: '/courier',
}

type Step = 'register' | 'verify'

export function RegisterPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

  const [step, setStep]             = useState<Step>('register')
  const [userId, setUserId]         = useState('')
  const [devOtp, setDevOtp]         = useState('')
  const [otp, setOtp]               = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  const [form, setForm] = useState({
    name: '', email: '', phone: '+7', password: '', role: 'COURIER',
  })

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  // Шаг 1 — регистрация
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/register', form)
      setUserId(data.data.userId)
      if (data.data._devOtp) setDevOtp(data.data._devOtp) // dev mode
      setStep('verify')
      startCooldown()
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Ошибка регистрации')
    } finally {
      setLoading(false)
    }
  }

  // Шаг 2 — подтверждение OTP
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/verify-phone', { userId, otp })
      const { accessToken, refreshToken, user } = data.data
      setAuth(user, accessToken, refreshToken)
      navigate(ROLE_REDIRECT[user.role] ?? '/courier')
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Неверный код')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    try {
      await api.post('/auth/resend-otp', { userId })
      startCooldown()
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Ошибка')
    }
  }

  const startCooldown = () => {
    setResendCooldown(60)
    const t = setInterval(() => {
      setResendCooldown(c => { if (c <= 1) { clearInterval(t); return 0 } return c - 1 })
    }, 1000)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
            <Truck size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Delivery Platform</h1>
          <p className="text-sm text-slate-500">
            {step === 'register' ? 'Создайте аккаунт' : 'Подтвердите телефон'}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{step === 'register' ? 'Регистрация' : 'Введите код из SMS'}</CardTitle>
            <CardDescription>
              {step === 'register'
                ? 'Заполните данные для создания аккаунта'
                : `Код отправлен на номер ${form.phone}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 'register' ? (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Имя и фамилия</Label>
                  <Input placeholder="Иван Иванов" value={form.name} onChange={f('name')} required minLength={2} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" placeholder="ivan@example.ru" value={form.email} onChange={f('email')} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Телефон</Label>
                  <Input
                    type="tel"
                    placeholder="+79001234567"
                    value={form.phone}
                    onChange={f('phone')}
                    required
                  />
                  <p className="text-xs text-slate-400">Формат: +7XXXXXXXXXX</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Пароль</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Минимум 8 символов"
                      value={form.password}
                      onChange={f('password')}
                      className="pr-10"
                      required
                      minLength={8}
                    />
                    <button type="button" tabIndex={-1}
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Роль</Label>
                  <select
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.role} onChange={f('role')}
                  >
                    <option value="COURIER">Курьер</option>
                    <option value="CLIENT">Клиент (B2B)</option>
                  </select>
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Регистрация...' : 'Зарегистрироваться'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerify} className="space-y-4">
                {devOtp && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                    <span className="font-medium">Dev режим:</span> код <span className="font-mono font-bold">{devOtp}</span>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Код из SMS</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="123456"
                    maxLength={6}
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="text-center text-2xl tracking-widest font-mono"
                    autoFocus
                    required
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading || otp.length < 4}>
                  {loading ? 'Проверка...' : 'Подтвердить'}
                </Button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown > 0}
                    className="text-sm text-blue-600 hover:underline disabled:text-slate-400 disabled:no-underline"
                  >
                    {resendCooldown > 0 ? `Повторная отправка через ${resendCooldown}с` : 'Отправить код ещё раз'}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => { setStep('register'); setError('') }}
                  className="w-full text-center text-sm text-slate-400 hover:text-slate-600"
                >
                  ← Изменить данные
                </button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-slate-500">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="text-blue-600 hover:underline font-medium">Войти</Link>
        </p>
      </div>
    </div>
  )
}
