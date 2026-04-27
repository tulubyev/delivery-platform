import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  RETURNING:  { label: 'Возврат',      variant: 'default' },
}

const FILTERS = [
  { key: '',           label: 'Все' },
  { key: 'CREATED',    label: 'Создан' },
  { key: 'ASSIGNED',   label: 'Назначен' },
  { key: 'IN_TRANSIT', label: 'В пути' },
  { key: 'DELIVERED',  label: 'Доставлен' },
  { key: 'CANCELLED',  label: 'Отменён' },
]

interface Order {
  id: string; number: string; status: string
  deliveryAddress: Record<string,string>
  recipientName: string
  createdAt: string; slaDeadlineAt: string|null
  trackingToken: string|null
}

export function ClientOrdersPage() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery<{ items: Order[]; total: number }>({
    queryKey: ['client-orders', status, page],
    queryFn: async () => {
      const params: Record<string,unknown> = { page, limit: 20 }
      if (status) params.status = status
      const { data } = await api.get('/orders', { params })
      return data.data
    },
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Мои заказы</h1>
          <p className="text-sm text-slate-500">{data?.total ?? 0} всего</p>
        </div>
        <Link to="/client/new">
          <Button size="sm">+ Новый заказ</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button key={f.key}
            onClick={() => { setStatus(f.key); setPage(1) }}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${status === f.key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading
            ? <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
            : (
              <>
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50">
                    <tr>
                      {['Номер', 'Статус', 'Получатель', 'Адрес', 'SLA', 'Создан', 'Трекинг'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data?.items.map(o => {
                      const s = STATUS_MAP[o.status]
                      const slaPassed = o.slaDeadlineAt && new Date(o.slaDeadlineAt) < new Date()
                      return (
                        <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <Link to={`/client/orders/${o.id}`} className="font-mono font-medium text-blue-600 hover:underline">
                              #{o.number}
                            </Link>
                          </td>
                          <td className="px-4 py-3"><Badge variant={s?.variant}>{s?.label ?? o.status}</Badge></td>
                          <td className="px-4 py-3 text-slate-700">{o.recipientName}</td>
                          <td className="px-4 py-3 max-w-[180px] truncate text-slate-500">
                            {Object.values(o.deliveryAddress).join(', ')}
                          </td>
                          <td className="px-4 py-3">
                            {o.slaDeadlineAt
                              ? <span className={slaPassed ? 'font-medium text-red-600' : 'text-slate-500'}>{formatDateTime(o.slaDeadlineAt)}</span>
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-500">{formatDateTime(o.createdAt)}</td>
                          <td className="px-4 py-3">
                            {o.trackingToken
                              ? <a href={`/track/${o.trackingToken}`} target="_blank" rel="noreferrer"
                                  className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                                  <ExternalLink size={12} />Отследить
                                </a>
                              : <span className="text-xs text-slate-300">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                    {!data?.items.length && (
                      <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">Заказы не найдены</td></tr>
                    )}
                  </tbody>
                </table>

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
            )
          }
        </CardContent>
      </Card>
    </div>
  )
}
