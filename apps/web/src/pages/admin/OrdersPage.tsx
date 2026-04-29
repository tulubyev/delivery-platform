import { useState } from 'react'
import { Plus, X, UserCheck } from 'lucide-react'
import { useOrders } from '@/queries/orders'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

interface Client { id: string; name: string }

const emptyForm = {
  recipientName:  '',
  recipientPhone: '+7',
  pickupCity:     'Москва',
  pickupStreet:   '',
  pickupBuilding: '',
  deliveryCity:   'Москва',
  deliveryStreet: '',
  deliveryBuilding: '',
  deliveryApartment: '',
  declaredValue:  '',
  notes:          '',
  clientId:       '',
}

function CreateOrderModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')

  const { data: clients } = useQuery<Client[]>({
    queryKey: ['clients-select'],
    queryFn: async () => {
      const { data } = await api.get('/clients')
      return data.data ?? []
    },
  })

  const create = useMutation({
    mutationFn: () => api.post('/orders', {
      clientId: form.clientId,
      recipientName: form.recipientName,
      recipientPhone: form.recipientPhone,
      pickupAddress: {
        city: form.pickupCity,
        street: form.pickupStreet,
        building: form.pickupBuilding,
      },
      deliveryAddress: {
        city: form.deliveryCity,
        street: form.deliveryStreet,
        building: form.deliveryBuilding,
        apartment: form.deliveryApartment || undefined,
      },
      declaredValue: form.declaredValue ? parseFloat(form.declaredValue) : undefined,
      notes: form.notes || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка создания заказа'
      setError(msg)
    },
  })

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Новый заказ</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Клиент */}
          <div>
            <Label>Клиент</Label>
            <select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.clientId} onChange={f('clientId')}>
              <option value="">Выберите клиента</option>
              {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Получатель */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Имя получателя</Label>
              <Input className="mt-1" placeholder="Иван Иванов" value={form.recipientName} onChange={f('recipientName')} />
            </div>
            <div>
              <Label>Телефон получателя</Label>
              <Input className="mt-1" placeholder="+79001234567" value={form.recipientPhone} onChange={f('recipientPhone')} />
            </div>
          </div>

          {/* Адрес отправки */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Адрес отправки (откуда)</p>
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="Город" value={form.pickupCity} onChange={f('pickupCity')} />
              <Input placeholder="Улица" value={form.pickupStreet} onChange={f('pickupStreet')} />
              <Input placeholder="Дом" value={form.pickupBuilding} onChange={f('pickupBuilding')} />
            </div>
          </div>

          {/* Адрес доставки */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Адрес доставки (куда)</p>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Город" value={form.deliveryCity} onChange={f('deliveryCity')} />
              <Input placeholder="Улица" value={form.deliveryStreet} onChange={f('deliveryStreet')} />
              <Input placeholder="Дом" value={form.deliveryBuilding} onChange={f('deliveryBuilding')} />
              <Input placeholder="Квартира (необязательно)" value={form.deliveryApartment} onChange={f('deliveryApartment')} />
            </div>
          </div>

          {/* Доп. поля */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Объявленная стоимость (₽)</Label>
              <Input className="mt-1" type="number" placeholder="0" value={form.declaredValue} onChange={f('declaredValue')} />
            </div>
          </div>
          <div>
            <Label>Примечание</Label>
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={2} placeholder="Хрупкое, не переворачивать..." value={form.notes}
              onChange={f('notes')}
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="flex gap-3 p-6 pt-0">
          <Button variant="outline" className="flex-1" onClick={onClose}>Отмена</Button>
          <Button className="flex-1" onClick={() => create.mutate()}
            disabled={!form.clientId || !form.recipientName || !form.recipientPhone || !form.pickupStreet || !form.deliveryStreet || create.isPending}>
            {create.isPending ? 'Создание...' : 'Создать заказ'}
          </Button>
        </div>
      </div>
    </div>
  )
}

interface OrderRow { id: string; number: string; status: string; deliveryAddress: unknown; slaDeadlineAt: string | null; createdAt: string }

function AssignModal({ order, onClose }: { order: OrderRow; onClose: () => void }) {
  const qc = useQueryClient()
  const [courierId, setCourierId] = useState('')
  const [error, setError] = useState('')

  const { data: couriers } = useQuery<{ id: string; user: { name: string } }[]>({
    queryKey: ['couriers-select'],
    queryFn: async () => {
      const { data } = await api.get('/couriers')
      return data.data?.items ?? data.data ?? []
    },
  })

  const assign = useMutation({
    mutationFn: () => api.post(`/orders/${order.id}/assign`, { courierId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); onClose() },
    onError: (e: unknown) => {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка назначения')
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Назначить курьера</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-500">Заказ <span className="font-mono font-medium text-blue-600">#{order.number}</span></p>
          <div>
            <Label>Курьер</Label>
            <select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={courierId} onChange={e => setCourierId(e.target.value)}>
              <option value="">Выберите курьера</option>
              {couriers?.map(c => <option key={c.id} value={c.id}>{c.user?.name ?? c.id}</option>)}
            </select>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="flex gap-3 p-6 pt-0">
          <Button variant="outline" className="flex-1" onClick={onClose}>Отмена</Button>
          <Button className="flex-1" disabled={!courierId || assign.isPending} onClick={() => assign.mutate()}>
            {assign.isPending ? 'Назначение...' : 'Назначить'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function OrdersPage() {
  const [status, setStatus] = useState<string | undefined>()
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [assignOrder, setAssignOrder] = useState<OrderRow | null>(null)

  const { data, isLoading } = useOrders({ status, page, limit: 20 })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Заказы</h1>
          <p className="text-sm text-slate-500">{data?.total ?? 0} всего</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={16} />Новый заказ
        </Button>
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
                    {['Номер', 'Статус', 'Адрес', 'SLA', 'Создан', ''].map(h => (
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
                        <td className="px-4 py-3 font-mono font-medium text-blue-600">#{o.number}</td>
                        <td className="px-4 py-3"><Badge variant={s?.variant}>{s?.label ?? o.status}</Badge></td>
                        <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                          {typeof o.deliveryAddress === 'object' ? Object.values(o.deliveryAddress as Record<string,string>).filter(Boolean).join(', ') : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {o.slaDeadlineAt
                            ? <span className={slaPassed ? 'font-medium text-red-600' : 'text-slate-500'}>{formatDateTime(o.slaDeadlineAt)}</span>
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-500">{formatDateTime(o.createdAt)}</td>
                        <td className="px-4 py-3">
                          {o.status === 'CREATED' && (
                            <button onClick={() => setAssignOrder(o as OrderRow)}
                              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                              <UserCheck size={14} />Назначить
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {!data?.items.length && (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">Заказы не найдены</td></tr>
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

      {showCreate && <CreateOrderModal onClose={() => setShowCreate(false)} />}
      {assignOrder && <AssignModal order={assignOrder} onClose={() => setAssignOrder(null)} />}
    </div>
  )
}
