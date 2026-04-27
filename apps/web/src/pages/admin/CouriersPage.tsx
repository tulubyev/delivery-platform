import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, Clock, Star, Truck } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'NOT_SUBMITTED'

interface Courier {
  id: string
  isOnline: boolean
  rating: number | null
  totalDeliveries: number
  verificationStatus: VerificationStatus
  selfEmployed: boolean
  user: { id: string; name: string; email: string; phone: string | null }
}

interface Paged { items: Courier[]; total: number; page: number; limit: number }

const VS_MAP: Record<VerificationStatus, { label: string; variant: 'default'|'primary'|'success'|'warning'|'destructive' }> = {
  NOT_SUBMITTED: { label: 'Не подан',    variant: 'default' },
  PENDING:       { label: 'На проверке', variant: 'warning' },
  APPROVED:      { label: 'Одобрен',     variant: 'success' },
  REJECTED:      { label: 'Отклонён',    variant: 'destructive' },
}

const VS_FILTERS: { key: VerificationStatus | ''; label: string }[] = [
  { key: '',              label: 'Все' },
  { key: 'PENDING',       label: 'На проверке' },
  { key: 'APPROVED',      label: 'Одобренные' },
  { key: 'REJECTED',      label: 'Отклонённые' },
  { key: 'NOT_SUBMITTED', label: 'Без документов' },
]

export function CouriersPage() {
  const qc = useQueryClient()
  const [vs, setVs] = useState<VerificationStatus | ''>('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Courier | null>(null)
  const [comment, setComment] = useState('')

  const { data, isLoading } = useQuery<Paged>({
    queryKey: ['couriers', vs, page],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit: 20 }
      if (vs) params.verificationStatus = vs
      const { data } = await api.get('/couriers', { params })
      return data.data
    },
  })

  const verify = useMutation({
    mutationFn: ({ id, approve, comment }: { id: string; approve: boolean; comment?: string }) =>
      api.patch(`/couriers/${id}/verify`, { approve, comment }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['couriers'] }); setSelected(null); setComment('') },
  })

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Курьеры</h1>
        <p className="text-sm text-slate-500">{data?.total ?? 0} всего</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {VS_FILTERS.map(f => (
          <button key={f.key} onClick={() => { setVs(f.key); setPage(1) }}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${vs === f.key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    {['Курьер', 'Контакт', 'Статус', 'Доставок', 'Рейтинг', 'Онлайн', 'Действия'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map(c => {
                    const vs = VS_MAP[c.verificationStatus]
                    return (
                      <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                              {c.user.name[0]?.toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">{c.user.name}</p>
                              {c.selfEmployed && <p className="text-xs text-slate-400">Самозанятый</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          <p>{c.user.email}</p>
                          {c.user.phone && <p className="text-xs">{c.user.phone}</p>}
                        </td>
                        <td className="px-4 py-3"><Badge variant={vs.variant}>{vs.label}</Badge></td>
                        <td className="px-4 py-3 font-medium text-slate-900">{c.totalDeliveries}</td>
                        <td className="px-4 py-3">
                          {c.rating != null ? (
                            <span className="flex items-center gap-1">
                              <Star size={13} className="text-amber-400 fill-amber-400" />{c.rating.toFixed(1)}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium ${c.isOnline ? 'text-green-600' : 'text-slate-400'}`}>
                            <Truck size={13} />{c.isOnline ? 'Онлайн' : 'Офлайн'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {c.verificationStatus === 'PENDING' && (
                            <button onClick={() => setSelected(c)} className="text-xs text-blue-600 hover:underline font-medium">
                              Проверить
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {!data?.items.length && (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">Курьеры не найдены</td></tr>
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

      {/* Verify modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelected(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900">Проверка документов</h2>
            <p className="mt-1 text-sm text-slate-500">{selected.user.name}</p>
            <textarea
              className="mt-4 w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3} placeholder="Комментарий (необязательно)"
              value={comment} onChange={e => setComment(e.target.value)}
            />
            <div className="mt-4 flex gap-3">
              <Button variant="destructive" className="flex-1" onClick={() => verify.mutate({ id: selected.id, approve: false, comment })}
                disabled={verify.isPending}>
                <XCircle size={16} />Отклонить
              </Button>
              <Button className="flex-1" onClick={() => verify.mutate({ id: selected.id, approve: true, comment })}
                disabled={verify.isPending}>
                <CheckCircle size={16} />Одобрить
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
