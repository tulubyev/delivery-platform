import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Building2, Users, LogOut, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'

const nav = [
  { to: '/superadmin/organizations', icon: Building2, label: 'Организации' },
  { to: '/superadmin/admins',        icon: Users,     label: 'Администраторы' },
]

export function SuperAdminLayout() {
  const { logout, user } = useAuthStore()
  const navigate = useNavigate()

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="flex w-56 flex-col bg-slate-950 py-4">
        <div className="mb-6 flex items-center gap-2.5 px-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-600">
            <ShieldCheck size={20} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-none">LastMiles</p>
            <p className="text-xs text-slate-400 mt-0.5">Суперадмин</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-2">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) => cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white',
                isActive && 'bg-slate-800 text-white',
              )}>
              <Icon size={18} className="shrink-0" />
              <span className="text-sm font-medium">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto px-2">
          <div className="flex items-center gap-2.5 px-3 py-2">
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
            <LogOut size={18} />
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
