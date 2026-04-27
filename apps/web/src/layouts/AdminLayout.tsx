import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Package, Users, Map, Warehouse, Clock, Bell, CreditCard, Settings, LogOut, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'
import { Tooltip } from '@radix-ui/react-tooltip'

const nav = [
  { to: '/admin',            icon: LayoutDashboard, label: 'Дашборд' },
  { to: '/admin/orders',     icon: Package,          label: 'Заказы' },
  { to: '/admin/couriers',   icon: Truck,            label: 'Курьеры' },
  { to: '/admin/shifts',     icon: Clock,            label: 'Смены' },
  { to: '/admin/zones',      icon: Map,              label: 'Зоны' },
  { to: '/admin/warehouses', icon: Warehouse,        label: 'Склады' },
  { to: '/admin/payments',   icon: CreditCard,       label: 'Платежи' },
  { to: '/admin/alerts',     icon: Bell,             label: 'Алерты' },
  { to: '/admin/settings',   icon: Settings,         label: 'Настройки' },
]

export function AdminLayout() {
  const { logout, user } = useAuthStore()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Icon sidebar */}
      <aside className="flex w-16 flex-col items-center gap-1 bg-slate-900 py-4">
        {/* Logo */}
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
          <Truck size={20} className="text-white" />
        </div>

        <nav className="flex flex-1 flex-col items-center gap-1">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/admin'}
              title={label}
              className={({ isActive }) =>
                cn('flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white',
                  isActive && 'bg-slate-800 text-white')
              }
            >
              <Icon size={20} />
            </NavLink>
          ))}
        </nav>

        {/* User + logout */}
        <div className="mt-auto flex flex-col items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
            {user?.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <button onClick={handleLogout} title="Выйти" className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-red-400">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
