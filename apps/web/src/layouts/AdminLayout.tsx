import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Package, Users, Map, Warehouse, Clock, Bell, CreditCard, Settings, LogOut, Truck, ChevronRight, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'

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
  const [expanded, setExpanded] = useState(false)

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside
        className={cn(
          'relative flex flex-col bg-slate-900 py-4 transition-all duration-300',
          expanded ? 'w-52' : 'w-16 items-center',
        )}
      >
        {/* Logo */}
        <div className={cn('mb-4 flex items-center gap-2.5', expanded ? 'px-4' : 'justify-center')}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600">
            <Truck size={20} className="text-white" />
          </div>
          {expanded && (
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-white leading-none">LastMiles</p>
              <p className="text-xs text-slate-400 mt-0.5">Панель управления</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className={cn('flex flex-1 flex-col gap-0.5', expanded ? 'px-2' : 'items-center px-0')}>
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/admin'}
              title={expanded ? undefined : label}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white',
                  expanded ? 'px-3 py-2.5 w-full' : 'h-10 w-10 justify-center',
                  isActive && 'bg-slate-800 text-white',
                )
              }
            >
              <Icon size={20} className="shrink-0" />
              {expanded && <span className="text-sm font-medium">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User + logout */}
        <div className={cn('mt-auto flex flex-col gap-1', expanded ? 'px-2' : 'items-center')}>
          {expanded ? (
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                {user?.name?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-white">{user?.name}</p>
                <p className="truncate text-xs text-slate-400">{user?.email}</p>
              </div>
            </div>
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white mb-1">
              {user?.name?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <button
            onClick={handleLogout}
            title="Выйти"
            className={cn(
              'flex items-center gap-3 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-red-400 transition-colors',
              expanded ? 'px-3 py-2.5 w-full' : 'h-10 w-10 justify-center',
            )}
          >
            <LogOut size={18} className="shrink-0" />
            {expanded && <span className="text-sm">Выйти</span>}
          </button>
        </div>

        {/* Toggle button */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="absolute -right-3 top-16 flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-slate-300 shadow-md hover:bg-slate-600 hover:text-white transition-colors z-10"
        >
          {expanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
