import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, ClipboardList, MapPin, LogOut, Truck } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'

const nav = [
  { to: '/courier',        icon: LayoutDashboard, label: 'Дашборд'    },
  { to: '/courier/orders', icon: ClipboardList,   label: 'Мои заказы' },
  { to: '/courier/plan',   icon: MapPin,           label: 'Маршрут'   },
]

export function CourierLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col bg-white border-r border-slate-200">
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-slate-100">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <Truck size={16} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">LastMiles</p>
            <p className="truncate text-xs text-slate-400">Кабинет курьера</p>
          </div>
        </div>

        {/* User */}
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-sm font-medium text-slate-900 truncate">{user?.name}</p>
          <p className="text-xs text-slate-400 truncate">{user?.email}</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === '/courier'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-2 border-t border-slate-100">
          <button onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors">
            <LogOut size={16} />Выйти
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
