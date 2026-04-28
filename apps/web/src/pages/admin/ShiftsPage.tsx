import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X, Clock, MapPin } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatDateTime } from '@/lib/utils'

interface Courier { id: string; user: { name: string } }
interface Zone    { id: string; name: string }
interface Shift {
  id: string
  status: 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  scheduledStart: string
  scheduledEnd: string
  actualStart: string | null
  actualEnd: string | null
  courier: { user: { name: string } }
  zone: { name: string } | null
}

const STATUS_MAP: Record<string, { label: string; variant: 'default'|'primary'|'success'|'warning'|'destructive' }> = {
  SCHEDULED:  { label: 'Запланирована', variant: 'primary' },
  ACTIVE:     { label: 'Активна',       variant: 'success' },
  COMPLETED:  { label: 'Завершена',     variant: 'default' },
  CANCELLED:  { label: 'Отменена',      variant: 'destructive' },
}

export function ShiftsPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [page, setPage] = useState(1)

  const [form, setForm] = useState({ courierId: '', zoneId: '', scheduledStart: '', scheduledEnd: '' })

  const { data: shifts, isLoading } = useQuery<Shift[]>({
    queryKey: ['shifts', date, page],
    queryFn: async () => {
      const { data } = await api.get('/shifts', { params: { date, page, limit: 20 } })
      return Array.isArray(data.data) ? data.data : data.data.items ?? []
    },
  })

  const { data: couriers } = useQuery<Courier[]>({
    queryKey: ['couriers-select'],
    queryFn: async () => { const { data } = await api.get('/couriers', { params: { limit: 100 } }); return data.data.items },
    enabled: showCreate,
  })

  const { data: zones } = useQuery<Zone[]>({
    queryKey: ['zones-select'],
    queryFn: async () => { const { data } = await api.get('/zones', { params: { limit: 100 } }); return data.data.items },
    enabled: showCreate,
  })

  const create = useMutation({
    mutationFn: () => api.post('/shifts', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shifts'] }); setShowCreate(false); setForm({ courierId: '', zoneId: '', scheduledStart: '', scheduledEnd: '' }) },
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Смены</h1>
          <p className="text-sm text-slate-500">{shifts?.length ?? 0} всего</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={16} />Создать смену
        </Button>
      </div>

      {/* Date filter */}
      <div className="flex items-center gap-3">
        <Clock size={16} className="text-slate-400" />
        <Input type="date" value={date} onChange={e => { setDate(e.target.value); setPage(1) }} className="w-44" />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    {['Курьер', 'Зона', 'Статус', 'Начало', 'Конец', 'Факт. начало', 'Факт. конец'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shifts?.map(s => {
                    const st = STATUS_MAP[s.status]
                    return (
                      <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">{s.courier.user.name}</td>
                        <td className="px-4 py-3">
                          {s.zone
                            ? <span className="flex items-center gap-1 text-slate-500"><MapPin size={12}/>{s.zone.name}</span>
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3"><Badge variant={st.variant}>{st.label}</Badge></td>
                        <td className="px-4 py-3 text-slate-500">{formatDateTime(s.scheduledStart)}</td>
                        <td className="px-4 py-3 text-slate-500">{formatDateTime(s.scheduledEnd)}</td>
                        <td className="px-4 py-3 text-slate-500">{s.actualStart ? formatDateTime(s.actualStart) : '—'}</td>
                        <td className="px-4 py-3 text-slate-500">{s.actualEnd   ? formatDateTime(s.actualEnd)   : '—'}</td>
                      </tr>
                    )
                  })}
                  {!shifts?.length && (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">Смены не найдены</td></tr>
                  )}
                </tbody>
              </table>

              {shifts && shifts.length >= 20 && (
                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                  <span className="text-sm text-slate-500">Страница {page}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Назад</Button>
                    <Button variant="outline" size="sm" disabled={shifts.length < 20} onClick={() => setPage(p => p + 1)}>Далее</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Новая смена</h2>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <Label>Курьер</Label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.courierId} onChange={e => setForm(f => ({ ...f, courierId: e.target.value }))}>
                  <option value="">Выберите курьера</option>
                  {couriers?.map(c => <option key={c.id} value={c.id}>{c.user.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Зона (необязательно)</Label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.zoneId} onChange={e => setForm(f => ({ ...f, zoneId: e.target.value }))}>
                  <option value="">Без зоны</option>
                  {zones?.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Начало</Label>
                <Input type="datetime-local" className="mt-1" value={form.scheduledStart} onChange={e => setForm(f => ({ ...f, scheduledStart: e.target.value }))} />
              </div>
              <div>
                <Label>Конец</Label>
                <Input type="datetime-local" className="mt-1" value={form.scheduledEnd} onChange={e => setForm(f => ({ ...f, scheduledEnd: e.target.value }))} />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>Отмена</Button>
              <Button className="flex-1" onClick={() => create.mutate()}
                disabled={!form.courierId || !form.scheduledStart || !form.scheduledEnd || create.isPending}>
                Создать
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
