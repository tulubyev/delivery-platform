import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Package, Plus, FileText, LogOut, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'

const nav = [
  { to: '/client',         icon: LayoutDashboard, label: 'Обзор',          end: true },
  { to: '/client/orders',  icon: Package,          label: 'Мои заказы' },
  { to: '/client/new',     icon: Plus,             label: 'Новый заказ' },
  { to: '/client/docs',    icon: FileText,         label: 'Документы' },
]

export function ClientLayout() {
  const { logout, user } = useAuthStore()
  const navigate = useNavigate()

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col border-r border-slate-200 bg-white">
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <Truck size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">Delivery</p>
            <p className="text-xs text-slate-400">Клиентский портал</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 p-2">
          {nav.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn('flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-slate-100 p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              {user?.name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-slate-900">{user?.name}</p>
              <p className="truncate text-xs text-slate-400">{user?.email}</p>
            </div>
            <button
              onClick={() => { logout(); navigate('/login') }}
              title="Выйти"
              className="text-slate-300 hover:text-red-500 transition-colors"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
