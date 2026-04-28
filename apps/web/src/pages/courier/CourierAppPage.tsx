import { Smartphone, QrCode, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth.store'
import { useNavigate } from 'react-router-dom'

export function CourierAppPage() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 shadow-lg">
            <Smartphone size={32} className="text-white" />
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-slate-900">Привет, {user?.name?.split(' ')[0]}!</h1>
          <p className="mt-1 text-slate-500">Для работы используйте мобильное приложение</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
              <QrCode size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-slate-900">LastMiles Courier</p>
              <p className="text-xs text-slate-500">Скачайте приложение для курьеров</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <a
              href="https://apps.apple.com/app/lastmiles-courier"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              App Store
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=ru.lastmiles.courier"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Google Play
            </a>
          </div>
        </div>

        <Button variant="ghost" className="w-full text-slate-500" onClick={handleLogout}>
          <LogOut size={16} className="mr-2" />Выйти
        </Button>
      </div>
    </div>
  )
}
