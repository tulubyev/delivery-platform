import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { OrderDrawer } from '@/components/admin/OrderDrawer'
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
const STATUSES = Object.entries(STATUS_MAP)

interface OrderRow {
  id: string; number: string; status: string; createdAt: string; slaDeadlineAt: string | null
  organization: { name: string } | null
  courier: { user: { name: string } } | null
  client: { companyName: string | null } | null
  deliveryAddress: Record<string, string>
}

interface Org { id: string; name: string }

export function SuperAdminAllOrdersPage() {
  const [status, setStatus] = useState<string | undefined>()
  const [orgId,  setOrgId]  = useState<string | undefined>()
  const [page,   setPage]   = useState(1)
  const [drawerId, setDrawerId] = useState<string | null>(null)

  const { data: orgs } = useQuery<{ items: Org[] }>({
    queryKey: ['superadmin-orgs'],
    queryFn: async () => { const { data } = await api.get('/organizations'); return data.data },
  })

  const { data, isLoading } = useQuery<{ items: OrderRow[]; total: number }>({
    queryKey: ['superadmin-orders', status, orgId, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (status) params.set('status', status)
      if (orgId)  params.set('organizationId', orgId)
      const { data } = await api.get(`/superadmin/orders?${params}`)
      return data.data
    },
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Все заказы</h1>
          <p className="text-sm text-slate-500">{data?.total ?? 0} всего</p>
        </div>
        <select
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={orgId ?? ''}
          onChange={e => { setOrgId(e.target.value || undefined); setPage(1) }}
        >
          <option value="">Все организации</option>
          {orgs?.items?.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => { setStatus(undefined); setPage(1) }}
          className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${!status ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
          Все
        </button>
        {STATUSES.map(([key, { label }]) => (
          <button key={key} onClick={() => { setStatus(key); setPage(1) }}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${status === key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
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
                    {['Номер', 'Статус', 'Организация', 'Клиент', 'Курьер', 'SLA', 'Создан'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map(o => {
                    const s = STATUS_MAP[o.status]
                    const slaPassed = o.slaDeadlineAt && new Date(o.slaDeadlineAt) < new Date()
                    return (
                      <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer"
                        onClick={() => setDrawerId(o.id)}>
                        <td className="px-4 py-3 font-mono font-medium text-blue-600">#{o.number}</td>
                        <td className="px-4 py-3"><Badge variant={s?.variant}>{s?.label ?? o.status}</Badge></td>
                        <td className="px-4 py-3 text-slate-600">{o.organization?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{o.client?.companyName ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-500">{o.courier?.user.name ?? '—'}</td>
                        <td className="px-4 py-3">
                          {o.slaDeadlineAt
                            ? <span className={slaPassed ? 'text-red-600 font-medium' : 'text-slate-500'}>{formatDateTime(o.slaDeadlineAt)}</span>
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-500">{formatDateTime(o.createdAt)}</td>
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
          )}
        </CardContent>
      </Card>

      {drawerId && <OrderDrawer orderId={drawerId} onClose={() => setDrawerId(null)} />}
    </div>
  )
}
