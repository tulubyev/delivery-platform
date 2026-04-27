import { useQuery } from '@tanstack/react-query'
import { Package, Truck, AlertTriangle, CheckCircle, Clock, TrendingUp } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime, formatMoney } from '@/lib/utils'
import { useAlertsCount } from '@/queries/alerts'

function StatCard({ title, value, sub, icon: Icon, color = 'blue' }: {
  title: string; value: string | number; sub?: string; icon: React.ElementType; color?: string
}) {
  const colors: Record<string, string> = { blue: 'bg-blue-50 text-blue-600', green: 'bg-green-50 text-green-600', amber: 'bg-amber-50 text-amber-600', red: 'bg-red-50 text-red-600' }
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">{title}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
            {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
          </div>
          <div className={`rounded-xl p-3 ${colors[color]}`}>
            <Icon size={22} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const STATUS_LABELS: Record<string, { label: string; variant: 'default'|'primary'|'success'|'warning'|'destructive' }> = {
  CREATED:    { label: 'Создан',      variant: 'default' },
  ASSIGNED:   { label: 'Назначен',    variant: 'primary' },
  PICKED_UP:  { label: 'Забран',      variant: 'warning' },
  IN_TRANSIT: { label: 'В пути',      variant: 'warning' },
  DELIVERED:  { label: 'Доставлен',   variant: 'success' },
  CANCELLED:  { label: 'Отменён',     variant: 'destructive' },
  FAILED:     { label: 'Не доставлен',variant: 'destructive' },
}

export function DashboardPage() {
  const { data: alertsCount } = useAlertsCount()
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [orders, couriers, payments] = await Promise.all([
        api.get('/orders?limit=5&page=1'),
        api.get('/tracking/online'),
        api.get('/payments/summary'),
      ])
      return { orders: orders.data.data, couriers: couriers.data.data, payments: payments.data.data }
    },
    refetchInterval: 30_000,
  })

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Дашборд</h1>
        <p className="text-sm text-slate-500">Обзор операций за сегодня</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />) : (<>
          <StatCard title="Заказов сегодня"  value={stats?.orders?.total ?? 0}            icon={Package}       color="blue" />
          <StatCard title="Курьеров онлайн"  value={stats?.couriers?.length ?? 0}          icon={Truck}         color="green" />
          <StatCard title="Активных алертов" value={alertsCount?.total ?? 0}               icon={AlertTriangle} color={alertsCount?.CRITICAL > 0 ? 'red' : 'amber'} />
          <StatCard title="Выручка (месяц)"  value={formatMoney(stats?.payments?.revenue ?? 0)} icon={TrendingUp}    color="green"
            sub={`Комиссия: ${formatMoney(stats?.payments?.commission ?? 0)}`} />
        </>)}
      </div>

      {/* Alerts summary */}
      {alertsCount && alertsCount.total > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-4 p-4">
            <AlertTriangle size={20} className="text-red-600 shrink-0" />
            <div className="flex flex-wrap gap-2">
              {alertsCount.CRITICAL > 0 && <Badge variant="destructive">Критические: {alertsCount.CRITICAL}</Badge>}
              {alertsCount.HIGH > 0 && <Badge variant="warning">Высокие: {alertsCount.HIGH}</Badge>}
              {alertsCount.MEDIUM > 0 && <Badge variant="default">Средние: {alertsCount.MEDIUM}</Badge>}
            </div>
            <a href="/admin/alerts" className="ml-auto text-sm font-medium text-red-700 hover:underline">Смотреть →</a>
          </CardContent>
        </Card>
      )}

      {/* Recent orders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Последние заказы</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  {['Номер', 'Статус', 'Курьер', 'SLA', 'Создан'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats?.orders?.items?.map((o: { id: string; number: string; status: string; courierId: string|null; slaDeadlineAt: string|null; createdAt: string }) => {
                  const s = STATUS_LABELS[o.status]
                  const slaPassed = o.slaDeadlineAt && new Date(o.slaDeadlineAt) < new Date()
                  return (
                    <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-medium text-blue-600">#{o.number}</td>
                      <td className="px-4 py-3"><Badge variant={s?.variant}>{s?.label ?? o.status}</Badge></td>
                      <td className="px-4 py-3 text-slate-500">{o.courierId ? 'Назначен' : '—'}</td>
                      <td className="px-4 py-3">
                        {o.slaDeadlineAt
                          ? <span className={slaPassed ? 'text-red-600 font-medium' : 'text-slate-500'}>{formatDateTime(o.slaDeadlineAt)}</span>
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDateTime(o.createdAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
