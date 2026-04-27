import { useState } from 'react'
import { Search, Filter, Plus } from 'lucide-react'
import { useOrders } from '@/queries/orders'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime } from '@/lib/utils'

const STATUS_MAP: Record<string, { label: string; variant: 'default'|'primary'|'success'|'warning'|'destructive' }> = {
  CREATED:    { label: 'Создан',        variant: 'default' },
  ASSIGNED:   { label: 'Назначен',      variant: 'primary' },
  PICKED_UP:  { label: 'Забран',        variant: 'warning' },
  IN_TRANSIT: { label: 'В пути',        variant: 'warning' },
  DELIVERED:  { label: 'Доставлен',     variant: 'success' },
  CANCELLED:  { label: 'Отменён',       variant: 'destructive' },
  FAILED:     { label: 'Не доставлен',  variant: 'destructive' },
  RETURNING:  { label: 'Возврат',       variant: 'default' },
}

const STATUSES = Object.entries(STATUS_MAP)

export function OrdersPage() {
  const [status, setStatus] = useState<string | undefined>()
  const [page, setPage] = useState(1)

  const { data, isLoading } = useOrders({ status, page, limit: 20 })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Заказы</h1>
          <p className="text-sm text-slate-500">{data?.total ?? 0} всего</p>
        </div>
        <Button size="sm"><Plus size={16} />Новый заказ</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStatus(undefined)}
          className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${!status ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
        >
          Все
        </button>
        {STATUSES.map(([key, { label }]) => (
          <button
            key={key}
            onClick={() => setStatus(key)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${status === key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    {['Номер', 'Статус', 'Адрес', 'SLA', 'Создан'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map(o => {
                    const s = STATUS_MAP[o.status]
                    const slaPassed = o.slaDeadlineAt && new Date(o.slaDeadlineAt) < new Date()
                    return (
                      <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer">
                        <td className="px-4 py-3 font-mono font-medium text-blue-600">#{o.number}</td>
                        <td className="px-4 py-3"><Badge variant={s?.variant}>{s?.label ?? o.status}</Badge></td>
                        <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                          {typeof o.deliveryAddress === 'object' ? Object.values(o.deliveryAddress).join(', ') : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {o.slaDeadlineAt
                            ? <span className={slaPassed ? 'font-medium text-red-600' : 'text-slate-500'}>{formatDateTime(o.slaDeadlineAt)}</span>
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-500">{formatDateTime(o.createdAt)}</td>
                      </tr>
                    )
                  })}
                  {!data?.items.length && (
                    <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400">Заказы не найдены</td></tr>
                  )}
                </tbody>
              </table>

              {/* Pagination */}
              {data && data.total > 20 && (
                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                  <span className="text-sm text-slate-500">Страница {page} из {Math.ceil(data.total / 20)}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Назад</Button>
                    <Button variant="outline" size="sm" disabled={page * 20 >= data.total} onClick={() => setPage(p => p + 1)}>Далее</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
