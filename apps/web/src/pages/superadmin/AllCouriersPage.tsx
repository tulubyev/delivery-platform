import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime } from '@/lib/utils'

interface Org { id: string; name: string }
interface CourierRow {
  id: string; isOnline: boolean; totalOrders: number; rating: number | null
  vehicleType: string | null; createdAt: string
  user: { name: string; email: string; phone: string }
  organization: { name: string } | null
}

export function SuperAdminAllCouriersPage() {
  const [orgId, setOrgId] = useState<string | undefined>()
  const [onlineOnly, setOnlineOnly] = useState(false)
  const [page, setPage] = useState(1)

  const { data: orgs } = useQuery<{ items: Org[] }>({
    queryKey: ['superadmin-orgs'],
    queryFn: async () => { const { data } = await api.get('/organizations'); return data.data },
  })

  const { data, isLoading } = useQuery<{ items: CourierRow[]; total: number }>({
    queryKey: ['superadmin-couriers', orgId, onlineOnly, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '30' })
      if (orgId)      params.set('organizationId', orgId)
      if (onlineOnly) params.set('isOnline', 'true')
      const { data } = await api.get(`/couriers?${params}`)
      return data.data
    },
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Все курьеры</h1>
          <p className="text-sm text-slate-500">{data?.total ?? 0} всего</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={onlineOnly} onChange={e => { setOnlineOnly(e.target.checked); setPage(1) }}
              className="rounded" />
            Только онлайн
          </label>
          <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={orgId ?? ''} onChange={e => { setOrgId(e.target.value || undefined); setPage(1) }}>
            <option value="">Все организации</option>
            {orgs?.items?.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
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
                    {['Курьер', 'Телефон', 'Организация', 'Статус', 'ТС', 'Заказов', 'Рейтинг', 'Добавлен'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map(c => (
                    <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{c.user.name}</p>
                        <p className="text-xs text-slate-400">{c.user.email}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{c.user.phone}</td>
                      <td className="px-4 py-3 text-slate-600">{c.organization?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${c.isOnline ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${c.isOnline ? 'bg-green-500' : 'bg-slate-400'}`} />
                          {c.isOnline ? 'Онлайн' : 'Офлайн'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{c.vehicleType ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-700 font-medium">{c.totalOrders}</td>
                      <td className="px-4 py-3 text-slate-600">{c.rating != null ? c.rating.toFixed(1) : '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDateTime(c.createdAt)}</td>
                    </tr>
                  ))}
                  {!data?.items.length && (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">Курьеры не найдены</td></tr>
                  )}
                </tbody>
              </table>
              {data && data.total > 30 && (
                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                  <span className="text-sm text-slate-500">Страница {page} из {Math.ceil(data.total / 30)}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Назад</Button>
                    <Button variant="outline" size="sm" disabled={page * 30 >= data.total} onClick={() => setPage(p => p + 1)}>Далее</Button>
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
