import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, ClipboardList, MapPin, LogOut, Truck, ChevronRight, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'

const nav = [
  { to: '/courier',        icon: LayoutDashboard, label: 'Дашборд'    },
  { to: '/courier/orders', icon: ClipboardList,   label: 'Мои заказы' },
  { to: '/courier/plan',   icon: MapPin,           label: 'Маршрут'   },
]

export function CourierLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside
        className={cn(
          'relative flex flex-col bg-white border-r border-slate-200 py-4 transition-all duration-300',
          expanded ? 'w-52' : 'w-16 items-center',
        )}
      >
        {/* Logo */}
        <div className={cn('mb-4 flex items-center gap-2.5', expanded ? 'px-4' : 'justify-center')}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600">
            <Truck size={16} className="text-white" />
          </div>
          {expanded && (
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-slate-900 leading-none">LastMiles</p>
              <p className="text-xs text-slate-400 mt-0.5">Кабинет курьера</p>
            </div>
          )}
        </div>

        {/* User */}
        <div className={cn('border-y border-slate-100 py-3 mb-2', expanded ? 'px-4' : 'flex justify-center')}>
          {expanded ? (
            <>
              <p className="text-sm font-medium text-slate-900 truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </>
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              {user?.name?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className={cn('flex flex-1 flex-col gap-0.5', expanded ? 'px-2' : 'items-center')}>
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === '/courier'}
              title={expanded ? undefined : label}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-lg text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900',
                  expanded ? 'px-3 py-2.5 w-full' : 'h-10 w-10 justify-center',
                  isActive && 'bg-blue-50 text-blue-700 font-medium',
                )
              }
            >
              <Icon size={16} className="shrink-0" />
              {expanded && <span className="text-sm">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className={cn('border-t border-slate-100 pt-2', expanded ? 'px-2' : 'flex justify-center')}>
          <button onClick={handleLogout}
            title={expanded ? undefined : 'Выйти'}
            className={cn(
              'flex items-center gap-2.5 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors',
              expanded ? 'px-3 py-2.5 w-full' : 'h-10 w-10 justify-center',
            )}
          >
            <LogOut size={16} className="shrink-0" />
            {expanded && <span className="text-sm">Выйти</span>}
          </button>
        </div>

        {/* Toggle button */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="absolute -right-3 top-14 flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-slate-600 shadow-md hover:bg-slate-300 transition-colors z-10"
        >
          {expanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
