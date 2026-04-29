import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Building2, Users, Package, Truck, Warehouse, LogOut, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'

const nav = [
  { to: '/superadmin',             icon: LayoutDashboard, label: 'Дашборд',       end: true },
  { to: '/superadmin/orders',      icon: Package,         label: 'Все заказы' },
  { to: '/superadmin/couriers',    icon: Truck,           label: 'Курьеры' },
  { to: '/superadmin/warehouses',  icon: Warehouse,       label: 'Склады' },
  { to: '/superadmin/users',       icon: Users,           label: 'Пользователи' },
  { to: '/superadmin/organizations', icon: Building2,     label: 'Организации' },
  { to: '/superadmin/admins',      icon: ShieldCheck,     label: 'Администраторы' },
]

export function SuperAdminLayout() {
  const { logout, user } = useAuthStore()
  const navigate = useNavigate()

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="flex w-56 shrink-0 flex-col bg-slate-950 py-4">
        {/* Logo */}
        <div className="mb-6 flex items-center gap-2.5 px-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-600">
            <ShieldCheck size={20} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-none">LastMiles</p>
            <p className="text-xs text-slate-400 mt-0.5">Суперадмин</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-0.5 px-2">
          {nav.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white',
                isActive && 'bg-slate-800 text-white',
              )}>
              <Icon size={18} className="shrink-0" />
              <span className="text-sm font-medium">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User + logout */}
        <div className="mt-auto px-2">
          <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
              {user?.name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-white">{user?.name}</p>
              <p className="truncate text-xs text-slate-400">ADMIN</p>
            </div>
          </div>
          <button onClick={() => { logout(); navigate('/login') }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-slate-400 hover:bg-slate-800 hover:text-red-400 transition-colors">
            <LogOut size={18} className="shrink-0" />
            <span className="text-sm">Выйти</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
