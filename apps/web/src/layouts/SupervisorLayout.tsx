import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { MapPin, Package, Bell, Users, LogOut, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'
import { useAlertsCount } from '@/queries/alerts'

const nav = [
  { to: '/supervisor',         icon: MapPin,  label: 'Карта' },
  { to: '/supervisor/orders',  icon: Package, label: 'Заказы' },
  { to: '/supervisor/couriers',icon: Users,   label: 'Курьеры' },
  { to: '/supervisor/alerts',  icon: Bell,    label: 'Алерты', badge: true },
]

export function SupervisorLayout() {
  const { logout, user } = useAuthStore()
  const navigate = useNavigate()
  const { data: alertsCount } = useAlertsCount()

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      {/* Top bar */}
      <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <Truck size={16} className="text-white" />
          </div>
          <span className="font-semibold text-slate-900">Супервизор</span>
        </div>

        <nav className="flex items-center gap-1">
          {nav.map(({ to, icon: Icon, label, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/supervisor'}
              className={({ isActive }) =>
                cn('relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100',
                  isActive && 'bg-blue-50 text-blue-700')
              }
            >
              <Icon size={16} />
              {label}
              {badge && (alertsCount?.total ?? 0) > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {(alertsCount?.total ?? 0) > 9 ? '9+' : alertsCount?.total}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">{user?.name}</span>
          <button onClick={() => { logout(); navigate('/login') }} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-red-500">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Map-first content */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
