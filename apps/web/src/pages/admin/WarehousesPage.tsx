import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X, Warehouse, Package, Truck, Clock } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

interface WarehouseItem {
  id: string
  name: string
  address: string
  lat: number | null
  lon: number | null
  phone: string | null
  isActive: boolean
}

interface Stats { total: number; delivered: number; pending: number; couriersOnShift: number }

function StatBox({ icon: Icon, label, value, color = 'slate' }: { icon: React.ElementType; label: string; value: number; color?: string }) {
  const colors: Record<string, string> = { slate: 'text-slate-600 bg-slate-50', blue: 'text-blue-600 bg-blue-50', green: 'text-green-600 bg-green-50', amber: 'text-amber-600 bg-amber-50' }
  return (
    <div className={`flex items-center gap-3 rounded-xl p-3 ${colors[color]}`}>
      <Icon size={18} />
      <div>
        <p className="text-lg font-bold leading-none">{value}</p>
        <p className="text-xs opacity-70">{label}</p>
      </div>
    </div>
  )
}

function WarehouseCard({ w }: { w: WarehouseItem }) {
  const today = new Date().toISOString().split('T')[0]
  const { data: stats } = useQuery<Stats>({
    queryKey: ['warehouse-stats', w.id, today],
    queryFn: async () => { const { data } = await api.get(`/warehouses/${w.id}/stats`, { params: { date: today } }); return data.data },
    refetchInterval: 60_000,
  })

  return (
    <Card className={w.isActive ? '' : 'opacity-50'}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <Warehouse size={18} />
            </div>
            <div>
              <CardTitle className="text-sm">{w.name}</CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">{w.address}</p>
            </div>
          </div>
          <span className={`text-xs font-medium ${w.isActive ? 'text-green-600' : 'text-slate-400'}`}>
            {w.isActive ? 'Активен' : 'Неактивен'}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {stats ? (
          <div className="grid grid-cols-2 gap-2">
            <StatBox icon={Package} label="Всего сегодня"  value={stats.total}          color="slate" />
            <StatBox icon={Package} label="Доставлено"     value={stats.delivered}      color="green" />
            <StatBox icon={Clock}   label="В ожидании"     value={stats.pending}        color="amber" />
            <StatBox icon={Truck}   label="Курьеров"       value={stats.couriersOnShift} color="blue" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function WarehousesPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', address: '', lat: '', lon: '', phone: '' })

  const { data, isLoading } = useQuery<WarehouseItem[]>({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const { data } = await api.get('/warehouses')
      return Array.isArray(data.data) ? data.data : data.data.items ?? []
    },
  })

  const create = useMutation({
    mutationFn: () => api.post('/warehouses', {
      name: form.name,
      address: form.address,
      lat: form.lat ? parseFloat(form.lat) : undefined,
      lon: form.lon ? parseFloat(form.lon) : undefined,
      phone: form.phone || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouses'] })
      setShowCreate(false)
      setForm({ name: '', address: '', lat: '', lon: '', phone: '' })
    },
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Склады</h1>
          <p className="text-sm text-slate-500">Статистика за сегодня</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={16} />Добавить склад
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-52" />)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data?.map(w => <WarehouseCard key={w.id} w={w} />)}
          {!data?.length && (
            <div className="col-span-3 py-16 text-center text-slate-400">Склады не добавлены</div>
          )}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Новый склад</h2>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <Label>Название</Label>
                <Input className="mt-1" placeholder="Главный склад" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label>Адрес</Label>
                <Input className="mt-1" placeholder="ул. Складская, 1" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Широта</Label>
                  <Input className="mt-1" placeholder="55.7558" value={form.lat} onChange={e => setForm(f => ({ ...f, lat: e.target.value }))} />
                </div>
                <div>
                  <Label>Долгота</Label>
                  <Input className="mt-1" placeholder="37.6173" value={form.lon} onChange={e => setForm(f => ({ ...f, lon: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Телефон (необязательно)</Label>
                <Input className="mt-1" placeholder="+7 (999) 000-00-00" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>Отмена</Button>
              <Button className="flex-1" onClick={() => create.mutate()} disabled={!form.name || !form.address || create.isPending}>Создать</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
