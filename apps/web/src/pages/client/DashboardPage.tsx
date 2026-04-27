import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Package, CheckCircle, Clock, AlertTriangle, ArrowRight } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime } from '@/lib/utils'

const STATUS_MAP: Record<string, { label: string; variant: 'default'|'primary'|'success'|'warning'|'destructive' }> = {
  CREATED:    { label: 'Создан',       variant: 'default' },
  ASSIGNED:   { label: 'Назначен',     variant: 'primary' },
  PICKED_UP:  { label: 'Забран',       variant: 'warning' },
  IN_TRANSIT: { label: 'В пути',       variant: 'warning' },
  DELIVERED:  { label: 'Доставлен',    variant: 'success' },
  CANCELLED:  { label: 'Отменён',      variant: 'destructive' },
  FAILED:     { label: 'Не доставлен', variant: 'destructive' },
}

interface Order { id: string; number: string; status: string; deliveryAddress: Record<string,string>; createdAt: string; slaDeadlineAt: string|null; trackingToken: string|null }

function StatCard({ icon: Icon, label, value, color = 'blue' }: { icon: React.ElementType; label: string; value: number; color?: string }) {
  const colors: Record<string,string> = {
    blue: 'bg-blue-50 text-blue-600', green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600', red: 'bg-red-50 text-red-600',
  }
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`rounded-xl p-3 ${colors[color]}`}><Icon size={22} /></div>
        <div>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          <p className="text-sm text-slate-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export function ClientDashboardPage() {
  const { data, isLoading } = useQuery<{ items: Order[]; total: number }>({
    queryKey: ['client-orders-dash'],
    queryFn: async () => {
      const { data } = await api.get('/orders', { params: { limit: 50 } })
      return data.data
    },
    refetchInterval: 30_000,
  })

  const orders = data?.items ?? []
  const active    = orders.filter(o => ['CREATED','ASSIGNED','PICKED_UP','IN_TRANSIT'].includes(o.status)).length
  const delivered = orders.filter(o => o.status === 'DELIVERED').length
  const failed    = orders.filter(o => ['CANCELLED','FAILED'].includes(o.status)).length
  const slaAt     = orders.filter(o => o.slaDeadlineAt && new Date(o.slaDeadlineAt) < new Date() && !['DELIVERED','CANCELLED'].includes(o.status)).length

  const recent = orders.slice(0, 8)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Обзор</h1>
        <p className="text-sm text-slate-500">Статистика за последние 50 заказов</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
          : <>
            <StatCard icon={Package}       label="Всего заказов"  value={data?.total ?? 0} color="blue" />
            <StatCard icon={Clock}         label="Активных"       value={active}           color="amber" />
            <StatCard icon={CheckCircle}   label="Доставлено"     value={delivered}        color="green" />
            <StatCard icon={AlertTriangle} label="Просроченных"   value={slaAt}            color="red" />
          </>
        }
      </div>

      {/* Recent orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Последние заказы</CardTitle>
          <Link to="/client/orders" className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline">
            Все заказы <ArrowRight size={14} />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading
            ? <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            : (
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    {['Номер', 'Статус', 'Адрес', 'SLA', 'Создан', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.map(o => {
                    const s = STATUS_MAP[o.status]
                    const slaPassed = o.slaDeadlineAt && new Date(o.slaDeadlineAt) < new Date()
                    return (
                      <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono font-medium text-blue-600">#{o.number}</td>
                        <td className="px-4 py-3"><Badge variant={s?.variant}>{s?.label ?? o.status}</Badge></td>
                        <td className="px-4 py-3 max-w-[200px] truncate text-slate-600">
                          {Object.values(o.deliveryAddress).join(', ')}
                        </td>
                        <td className="px-4 py-3">
                          {o.slaDeadlineAt
                            ? <span className={slaPassed ? 'font-medium text-red-600' : 'text-slate-500'}>{formatDateTime(o.slaDeadlineAt)}</span>
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-500">{formatDateTime(o.createdAt)}</td>
                        <td className="px-4 py-3">
                          <Link to={`/client/orders/${o.id}`} className="text-xs text-blue-600 hover:underline">Открыть</Link>
                        </td>
                      </tr>
                    )
                  })}
                  {!recent.length && (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">Заказов нет</td></tr>
                  )}
                </tbody>
              </table>
            )
          }
        </CardContent>
      </Card>
    </div>
  )
}
