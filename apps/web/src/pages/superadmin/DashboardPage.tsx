import { useQuery } from '@tanstack/react-query'
import { Building2, Users, Package, Truck, Activity, TrendingUp } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface Stats {
  totalOrgs: number; totalUsers: number; totalOrders: number
  todayOrders: number; activeOrders: number; onlineCouriers: number; totalRevenue: number
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string
}) {
  return (
    <Card>
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
        </div>
        <div className={`rounded-2xl p-3 ${color}`}>
          <Icon size={24} />
        </div>
      </CardContent>
    </Card>
  )
}

export function SuperAdminDashboardPage() {
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ['superadmin-stats'],
    queryFn: async () => {
      const { data } = await api.get('/superadmin/stats')
      return data.data
    },
    refetchInterval: 30_000,
  })

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Глобальный дашборд</h1>
        <p className="text-sm text-slate-500">Статистика по всем организациям в реальном времени</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatCard icon={Building2}  label="Организации"      value={stats?.totalOrgs ?? 0}      color="bg-violet-50 text-violet-600" />
          <StatCard icon={Users}      label="Пользователи"     value={stats?.totalUsers ?? 0}      color="bg-blue-50 text-blue-600" />
          <StatCard icon={Package}    label="Заказов сегодня"  value={stats?.todayOrders ?? 0}     sub={`Всего: ${stats?.totalOrders ?? 0}`} color="bg-sky-50 text-sky-600" />
          <StatCard icon={Activity}   label="Активные заказы"  value={stats?.activeOrders ?? 0}    color="bg-amber-50 text-amber-600" />
          <StatCard icon={Truck}      label="Курьеры онлайн"   value={stats?.onlineCouriers ?? 0}  color="bg-green-50 text-green-600" />
          <StatCard icon={TrendingUp} label="Выручка (всего)"  value={`${(stats?.totalRevenue ?? 0).toLocaleString('ru')} ₽`} color="bg-emerald-50 text-emerald-600" />
        </div>
      )}
    </div>
  )
}
