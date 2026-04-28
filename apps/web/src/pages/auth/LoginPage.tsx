import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Truck, Eye, EyeOff } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

interface LoginForm { email: string; password: string }

const ROLE_REDIRECT: Record<string, string> = {
  ADMIN: '/admin', ORG_ADMIN: '/admin', SUPERVISOR: '/supervisor', CLIENT: '/client', COURIER: '/courier',
}

export function LoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [error, setError]           = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<LoginForm>()

  const onSubmit = async (form: LoginForm) => {
    setError('')
    try {
      const { data } = await api.post('/auth/login', form)
      const { accessToken, refreshToken, user } = data.data
      setAuth(user, accessToken, refreshToken)
      navigate(ROLE_REDIRECT[user.role] ?? '/admin')
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Ошибка входа')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
            <Truck size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Delivery Platform</h1>
          <p className="text-sm text-slate-500">Управление доставкой</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Вход в систему</CardTitle>
            <CardDescription>Введите ваш email и пароль</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@company.ru"
                  autoComplete="email"
                  {...register('email', { required: true })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Пароль</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="pr-10"
                    {...register('password', { required: true })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Вход...' : 'Войти'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
