import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X, Trash2, Map } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

interface Zone {
  id: string
  name: string
  color: string | null
  isActive: boolean
  polygon: unknown
  _count?: { couriers: number; shifts: number }
}

const PRESET_COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2']

export function ZonesPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', color: '#2563eb', polygon: '' })
  const [polyError, setPolyError] = useState('')

  const { data: zones, isLoading } = useQuery<{ items: Zone[]; total: number }>({
    queryKey: ['zones'],
    queryFn: async () => { const { data } = await api.get('/zones'); return data.data },
  })

  const create = useMutation({
    mutationFn: () => {
      let polygon
      try { polygon = JSON.parse(form.polygon) } catch { throw new Error('Невалидный JSON') }
      return api.post('/zones', { name: form.name, color: form.color, polygon })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['zones'] }); setShowCreate(false); setForm({ name: '', color: '#2563eb', polygon: '' }) },
    onError: (e: Error) => setPolyError(e.message),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/zones/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['zones'] }),
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Зоны доставки</h1>
          <p className="text-sm text-slate-500">{zones?.total ?? 0} зон</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={16} />Добавить зону
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {zones?.items.map(z => (
            <Card key={z.id} className="relative overflow-hidden">
              {/* Color strip */}
              <div className="h-1.5 w-full" style={{ backgroundColor: z.color ?? '#2563eb' }} />
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Map size={14} style={{ color: z.color ?? '#2563eb' }} />
                      <p className="font-semibold text-slate-900">{z.name}</p>
                    </div>
                    <div className="mt-2 flex gap-3 text-xs text-slate-500">
                      {z._count && <>
                        <span>{z._count.couriers} курьеров</span>
                        <span>{z._count.shifts} смен</span>
                      </>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={z.isActive ? 'success' : 'default'}>{z.isActive ? 'Активна' : 'Неактивна'}</Badge>
                    <button onClick={() => { if (confirm(`Удалить зону «${z.name}»?`)) remove.mutate(z.id) }}
                      className="text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {!zones?.items.length && (
            <div className="col-span-3 py-16 text-center text-slate-400">Зоны не настроены</div>
          )}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Новая зона</h2>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <Label>Название</Label>
                <Input className="mt-1" placeholder="Центр города" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label>Цвет</Label>
                <div className="mt-1 flex gap-2">
                  {PRESET_COLORS.map(c => (
                    <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                      className={`h-7 w-7 rounded-full transition-all ${form.color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : ''}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <div>
                <Label>Полигон (GeoJSON координаты)</Label>
                <textarea
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-3 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={'[[37.61,55.75],[37.62,55.75],[37.62,55.76],[37.61,55.75]]'}
                  value={form.polygon} onChange={e => { setForm(f => ({ ...f, polygon: e.target.value })); setPolyError('') }}
                />
                {polyError && <p className="mt-1 text-xs text-red-600">{polyError}</p>}
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>Отмена</Button>
              <Button className="flex-1" onClick={() => create.mutate()} disabled={!form.name || !form.polygon || create.isPending}>Создать</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
