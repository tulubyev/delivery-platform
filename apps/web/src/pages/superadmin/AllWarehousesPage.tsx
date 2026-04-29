import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface Org { id: string; name: string }
interface WarehouseRow {
  id: string; name: string; address: string | Record<string, string>; isActive: boolean
  organization: { name: string } | null
}

export function SuperAdminAllWarehousesPage() {
  const [orgId, setOrgId] = useState<string | undefined>()

  const { data: orgs } = useQuery<{ items: Org[] }>({
    queryKey: ['superadmin-orgs'],
    queryFn: async () => { const { data } = await api.get('/organizations'); return data.data },
  })

  const { data, isLoading } = useQuery<WarehouseRow[]>({
    queryKey: ['superadmin-warehouses', orgId],
    queryFn: async () => {
      const params = orgId ? `?organizationId=${orgId}` : ''
      const { data } = await api.get(`/warehouses${params}`)
      return Array.isArray(data.data) ? data.data : data.data?.items ?? []
    },
  })

  const fmtAddr = (a: string | Record<string, string> | null) =>
    !a ? '—' : typeof a === 'string' ? a : Object.values(a).filter(Boolean).join(', ')

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Все склады</h1>
          <p className="text-sm text-slate-500">{data?.length ?? 0} всего</p>
        </div>
        <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          value={orgId ?? ''} onChange={e => setOrgId(e.target.value || undefined)}>
          <option value="">Все организации</option>
          {orgs?.items?.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  {['Название', 'Организация', 'Адрес', 'Статус'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.map(w => (
                  <tr key={w.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{w.name}</td>
                    <td className="px-4 py-3 text-slate-600">{w.organization?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{fmtAddr(w.address)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${w.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {w.isActive ? 'Активен' : 'Неактивен'}
                      </span>
                    </td>
                  </tr>
                ))}
                {!data?.length && (
                  <tr><td colSpan={4} className="px-4 py-12 text-center text-slate-400">Склады не найдены</td></tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
