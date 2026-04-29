import { useState, useEffect } from 'react'
import { X, UserCheck, Send, Clock, Edit3, MessageSquare, Eye, Phone, MessageCircle, Bell } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
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

const STATUS_TRANSITIONS: Record<string, string[]> = {
  CREATED:    ['CANCELLED'],
  ASSIGNED:   ['PICKED_UP', 'CANCELLED'],
  PICKED_UP:  ['IN_TRANSIT'],
  IN_TRANSIT: ['DELIVERED', 'FAILED', 'RETURNING'],
  RETURNING:  ['DELIVERED', 'FAILED'],
}

type Tab = 'overview' | 'edit' | 'messages' | 'history'

interface OrderDetail {
  id: string; number: string; status: string; notes: string | null
  recipientName: string; recipientPhone: string
  pickupAddress: Record<string, string>; deliveryAddress: Record<string, string>
  declaredValue: number | null; weight: number | null; paymentOnDelivery: boolean
  scheduledAt: string | null; slaDeadlineAt: string | null; createdAt: string
  client: { companyName: string | null } | null
  courier: { id: string; user: { name: string; phone: string } } | null
  statusHistory: { id: string; status: string; createdAt: string; comment: string | null; createdBy: string | null }[]
}

interface Props { orderId: string; onClose: () => void }

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-slate-800">{value || '—'}</p>
    </div>
  )
}

export function OrderDrawer({ orderId, onClose }: Props) {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('overview')
  const [reassign, setReassign] = useState(false)
  const [newCourierId, setNewCourierId] = useState('')

  // Edit form state
  const [editForm, setEditForm] = useState({
    recipientName: '', recipientPhone: '',
    deliveryCity: '', deliveryStreet: '', deliveryBuilding: '', deliveryApt: '',
    pickupCity: '', pickupStreet: '', pickupBuilding: '',
    notes: '', weight: '', declaredValue: '', paymentOnDelivery: false, scheduledAt: '',
  })

  // Messaging state
  const [msgTarget, setMsgTarget] = useState<'courier' | 'admin' | null>(null)
  const [msgText, setMsgText] = useState('')

  const { data: order, isLoading } = useQuery<OrderDetail>({
    queryKey: ['order-detail', orderId],
    queryFn: async () => { const { data } = await api.get(`/orders/${orderId}`); return data.data },
  })

  useEffect(() => {
    if (order) {
      const da = order.deliveryAddress ?? {}
      const pa = order.pickupAddress ?? {}
      setEditForm({
        recipientName:    order.recipientName,
        recipientPhone:   order.recipientPhone,
        deliveryCity:     da.city     ?? da.город   ?? '',
        deliveryStreet:   da.street   ?? da.улица   ?? '',
        deliveryBuilding: da.building ?? da.дом     ?? '',
        deliveryApt:      da.apt      ?? da.квартира ?? '',
        pickupCity:     pa.city     ?? pa.город   ?? '',
        pickupStreet:   pa.street   ?? pa.улица   ?? '',
        pickupBuilding: pa.building ?? pa.дом     ?? '',
        notes:          order.notes          ?? '',
        weight:         order.weight         != null ? String(order.weight)        : '',
        declaredValue:  order.declaredValue  != null ? String(order.declaredValue) : '',
        paymentOnDelivery: order.paymentOnDelivery,
        scheduledAt:    order.scheduledAt ? order.scheduledAt.slice(0, 16) : '',
      })
    }
  }, [order])

  const { data: couriers } = useQuery<{ id: string; user: { name: string } }[]>({
    queryKey: ['couriers-select'],
    queryFn: async () => { const { data } = await api.get('/couriers'); return data.data?.items ?? data.data ?? [] },
    enabled: reassign,
  })

  const changeStatus = useMutation({
    mutationFn: (status: string) => api.patch(`/orders/${orderId}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['order-detail', orderId] })
    },
  })

  const assignCourier = useMutation({
    mutationFn: () => api.post(`/orders/${orderId}/assign`, { courierId: newCourierId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['order-detail', orderId] })
      setReassign(false)
    },
  })

  const saveEdit = useMutation({
    mutationFn: () => api.patch(`/orders/${orderId}`, {
      recipientName:   editForm.recipientName   || undefined,
      recipientPhone:  editForm.recipientPhone  || undefined,
      notes:           editForm.notes           || undefined,
      weight:          editForm.weight          ? parseFloat(editForm.weight) : undefined,
      declaredValue:   editForm.declaredValue   ? parseFloat(editForm.declaredValue) : undefined,
      paymentOnDelivery: editForm.paymentOnDelivery,
      scheduledAt:     editForm.scheduledAt     || undefined,
      deliveryAddress: {
        city:     editForm.deliveryCity,
        street:   editForm.deliveryStreet,
        building: editForm.deliveryBuilding,
        apt:      editForm.deliveryApt,
      },
      pickupAddress: {
        city:     editForm.pickupCity,
        street:   editForm.pickupStreet,
        building: editForm.pickupBuilding,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['order-detail', orderId] })
      setTab('overview')
    },
  })

  const sendMessage = useMutation({
    mutationFn: () => {
      if (msgTarget === 'courier' && order?.courier) {
        return api.post(`/notifications/couriers/${order.courier.id}/push`, {
          title: `Заказ #${order.number}`,
          body: msgText,
        })
      }
      return api.post('/notifications/admin/push', { title: `Заказ #${order?.number}`, body: msgText })
    },
    onSuccess: () => { setMsgText(''); setMsgTarget(null) },
  })

  const addr = (a: Record<string, string> | undefined) =>
    a ? Object.values(a).filter(Boolean).join(', ') : '—'

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview',  label: 'Обзор',       icon: Eye },
    { id: 'edit',      label: 'Редактировать',icon: Edit3 },
    { id: 'messages',  label: 'Сообщения',    icon: MessageSquare },
    { id: 'history',   label: 'История',      icon: Clock },
  ]

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-xl bg-white shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg font-bold text-blue-600">
              {isLoading ? '...' : `#${order?.number}`}
            </span>
            {order && <Badge variant={STATUS_MAP[order.status]?.variant}>{STATUS_MAP[order.status]?.label ?? order.status}</Badge>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 shrink-0">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors
                ${tab === t.id
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-slate-500 hover:text-slate-700'}`}>
              <t.icon size={13} />{t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
          ) : order ? (
            <>
              {/* ── ОБЗОР ── */}
              {tab === 'overview' && (
                <div className="space-y-6">
                  {/* Получатель */}
                  <section>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Получатель</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Имя"    value={order.recipientName} />
                      <Field label="Телефон" value={order.recipientPhone} />
                    </div>
                  </section>

                  {/* Адреса */}
                  <section>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Маршрут</h3>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5 h-5 w-5 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold shrink-0">А</span>
                        <span className="text-slate-700">{addr(order.pickupAddress)}</span>
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5 h-5 w-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">Б</span>
                        <span className="text-slate-700">{addr(order.deliveryAddress)}</span>
                      </div>
                    </div>
                  </section>

                  {/* Детали */}
                  <section>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Параметры</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Клиент"   value={order.client?.companyName} />
                      <Field label="Создан"   value={formatDateTime(order.createdAt)} />
                      {order.weight != null && <Field label="Вес (кг)" value={String(order.weight)} />}
                      {order.declaredValue != null && (
                        <Field label="Стоимость" value={`${order.declaredValue.toLocaleString('ru')} ₽`} />
                      )}
                      <Field label="Оплата при доставке" value={order.paymentOnDelivery ? 'Да' : 'Нет'} />
                      {order.slaDeadlineAt && (
                        <div>
                          <p className="text-xs font-medium text-slate-400 uppercase mb-0.5">SLA</p>
                          <p className={`text-sm font-medium ${new Date(order.slaDeadlineAt) < new Date() ? 'text-red-600' : 'text-slate-800'}`}>
                            {formatDateTime(order.slaDeadlineAt)}
                            {new Date(order.slaDeadlineAt) < new Date() && ' ⚠️'}
                          </p>
                        </div>
                      )}
                      {order.scheduledAt && <Field label="Запланирован" value={formatDateTime(order.scheduledAt)} />}
                      {order.notes && <div className="col-span-2"><Field label="Примечание" value={order.notes} /></div>}
                    </div>
                  </section>

                  {/* Курьер */}
                  <section>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Курьер</h3>
                      <button onClick={() => setReassign(v => !v)}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                        <UserCheck size={13} />{order.courier ? 'Переназначить' : 'Назначить'}
                      </button>
                    </div>
                    {order.courier ? (
                      <div className="rounded-xl bg-slate-50 p-3 flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">
                          {order.courier.user.name[0]}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 text-sm">{order.courier.user.name}</p>
                          <a href={`tel:${order.courier.user.phone}`}
                             className="flex items-center gap-1 text-xs text-blue-500 hover:underline">
                            <Phone size={10} />{order.courier.user.phone}
                          </a>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 italic">Не назначен</p>
                    )}
                    {reassign && (
                      <div className="mt-3 flex gap-2">
                        <select className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                          value={newCourierId} onChange={e => setNewCourierId(e.target.value)}>
                          <option value="">Выберите курьера</option>
                          {couriers?.map(c => <option key={c.id} value={c.id}>{c.user?.name}</option>)}
                        </select>
                        <Button size="sm" disabled={!newCourierId || assignCourier.isPending}
                          onClick={() => assignCourier.mutate()}>
                          {assignCourier.isPending ? '...' : 'ОК'}
                        </Button>
                      </div>
                    )}
                  </section>

                  {/* Смена статуса */}
                  {STATUS_TRANSITIONS[order.status]?.length > 0 && (
                    <section>
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Изменить статус</h3>
                      <div className="flex flex-wrap gap-2">
                        {STATUS_TRANSITIONS[order.status].map(s => (
                          <Button key={s} variant="outline" size="sm"
                            disabled={changeStatus.isPending}
                            onClick={() => changeStatus.mutate(s)}>
                            → {STATUS_MAP[s]?.label ?? s}
                          </Button>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}

              {/* ── РЕДАКТИРОВАТЬ ── */}
              {tab === 'edit' && (
                <div className="space-y-6">
                  <section>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Получатель</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Имя</Label>
                        <Input className="mt-1" value={editForm.recipientName}
                          onChange={e => setEditForm(f => ({ ...f, recipientName: e.target.value }))} />
                      </div>
                      <div>
                        <Label className="text-xs">Телефон</Label>
                        <Input className="mt-1" value={editForm.recipientPhone}
                          onChange={e => setEditForm(f => ({ ...f, recipientPhone: e.target.value }))} />
                      </div>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Адрес доставки</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Город</Label>
                        <Input className="mt-1" value={editForm.deliveryCity}
                          onChange={e => setEditForm(f => ({ ...f, deliveryCity: e.target.value }))} />
                      </div>
                      <div>
                        <Label className="text-xs">Улица</Label>
                        <Input className="mt-1" value={editForm.deliveryStreet}
                          onChange={e => setEditForm(f => ({ ...f, deliveryStreet: e.target.value }))} />
                      </div>
                      <div>
                        <Label className="text-xs">Дом</Label>
                        <Input className="mt-1" value={editForm.deliveryBuilding}
                          onChange={e => setEditForm(f => ({ ...f, deliveryBuilding: e.target.value }))} />
                      </div>
                      <div>
                        <Label className="text-xs">Кв/Офис</Label>
                        <Input className="mt-1" value={editForm.deliveryApt}
                          onChange={e => setEditForm(f => ({ ...f, deliveryApt: e.target.value }))} />
                      </div>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Адрес забора</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Город</Label>
                        <Input className="mt-1" value={editForm.pickupCity}
                          onChange={e => setEditForm(f => ({ ...f, pickupCity: e.target.value }))} />
                      </div>
                      <div>
                        <Label className="text-xs">Улица</Label>
                        <Input className="mt-1" value={editForm.pickupStreet}
                          onChange={e => setEditForm(f => ({ ...f, pickupStreet: e.target.value }))} />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Дом/строение</Label>
                        <Input className="mt-1" value={editForm.pickupBuilding}
                          onChange={e => setEditForm(f => ({ ...f, pickupBuilding: e.target.value }))} />
                      </div>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Параметры заказа</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Вес (кг)</Label>
                        <Input className="mt-1" type="number" step="0.1" min="0" value={editForm.weight}
                          onChange={e => setEditForm(f => ({ ...f, weight: e.target.value }))} />
                      </div>
                      <div>
                        <Label className="text-xs">Объявленная стоимость (₽)</Label>
                        <Input className="mt-1" type="number" min="0" value={editForm.declaredValue}
                          onChange={e => setEditForm(f => ({ ...f, declaredValue: e.target.value }))} />
                      </div>
                      <div>
                        <Label className="text-xs">Запланировать на</Label>
                        <Input className="mt-1" type="datetime-local" value={editForm.scheduledAt}
                          onChange={e => setEditForm(f => ({ ...f, scheduledAt: e.target.value }))} />
                      </div>
                      <div className="flex items-center gap-2 pt-5">
                        <input type="checkbox" id="pod" checked={editForm.paymentOnDelivery}
                          onChange={e => setEditForm(f => ({ ...f, paymentOnDelivery: e.target.checked }))}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                        <Label htmlFor="pod" className="text-xs cursor-pointer">Оплата при доставке</Label>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Примечание</Label>
                        <textarea className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={3} value={editForm.notes}
                          onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
                      </div>
                    </div>
                  </section>

                  <div className="flex gap-2 pb-4">
                    <Button onClick={() => saveEdit.mutate()} disabled={saveEdit.isPending} className="flex-1">
                      {saveEdit.isPending ? 'Сохранение...' : 'Сохранить изменения'}
                    </Button>
                    <Button variant="outline" onClick={() => setTab('overview')}>Отмена</Button>
                  </div>
                  {saveEdit.isError && (
                    <p className="text-xs text-red-600">Ошибка сохранения. Проверьте данные.</p>
                  )}
                </div>
              )}

              {/* ── СООБЩЕНИЯ ── */}
              {tab === 'messages' && (
                <div className="space-y-6">
                  {/* Курьер */}
                  {order.courier && (
                    <section className="rounded-xl border border-slate-100 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">Курьер</h3>
                          <p className="text-xs text-slate-500">{order.courier.user.name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <a href={`tel:${order.courier.user.phone}`}
                             className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                            <Phone size={12} /> Позвонить
                          </a>
                          <a href={`sms:${order.courier.user.phone}`}
                             className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                            <MessageCircle size={12} /> SMS
                          </a>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1.5">Push-уведомление в приложение:</p>
                        <div className="flex gap-2">
                          <input
                            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Текст сообщения курьеру..."
                            value={msgTarget === 'courier' ? msgText : ''}
                            onChange={e => { setMsgTarget('courier'); setMsgText(e.target.value) }}
                          />
                          <Button size="sm"
                            disabled={msgTarget !== 'courier' || !msgText.trim() || sendMessage.isPending}
                            onClick={() => sendMessage.mutate()}>
                            <Send size={14} />
                          </Button>
                        </div>
                      </div>
                    </section>
                  )}

                  {/* Получатель */}
                  <section className="rounded-xl border border-slate-100 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">Получатель</h3>
                        <p className="text-xs text-slate-500">{order.recipientName} · {order.recipientPhone}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <a href={`tel:${order.recipientPhone}`}
                           className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                          <Phone size={12} /> Позвонить
                        </a>
                        <a href={`sms:${order.recipientPhone}?body=Ваш заказ %23${order.number}`}
                           className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                          <MessageCircle size={12} /> SMS
                        </a>
                      </div>
                    </div>
                  </section>

                  {/* Орг-Админ */}
                  <section className="rounded-xl border border-slate-100 p-4 space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Администратор организации</h3>
                      <p className="text-xs text-slate-500">Push-уведомление всем орг-админам</p>
                    </div>
                    <div className="flex gap-2">
                      <input
                        className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Сообщение орг-админу..."
                        value={msgTarget === 'admin' ? msgText : ''}
                        onChange={e => { setMsgTarget('admin'); setMsgText(e.target.value) }}
                      />
                      <Button size="sm" variant="outline"
                        disabled={msgTarget !== 'admin' || !msgText.trim() || sendMessage.isPending}
                        onClick={() => sendMessage.mutate()}>
                        <Bell size={14} />
                      </Button>
                    </div>
                  </section>

                  {sendMessage.isSuccess && (
                    <p className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                      ✓ Сообщение отправлено
                    </p>
                  )}
                </div>
              )}

              {/* ── ИСТОРИЯ ── */}
              {tab === 'history' && (
                <div className="space-y-1">
                  {order.statusHistory.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">История пуста</p>
                  ) : (
                    <div className="space-y-0">
                      {order.statusHistory.map((ev, i) => (
                        <div key={ev.id} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className={`mt-1 h-3 w-3 rounded-full shrink-0
                              ${i === order.statusHistory.length - 1 ? 'bg-blue-600' : 'bg-slate-300'}`} />
                            {i < order.statusHistory.length - 1 && (
                              <div className="w-px flex-1 bg-slate-200 my-1" style={{ minHeight: 24 }} />
                            )}
                          </div>
                          <div className="pb-4">
                            <p className="text-sm font-semibold text-slate-900">{STATUS_MAP[ev.status]?.label ?? ev.status}</p>
                            {ev.comment && <p className="text-xs text-slate-500 mt-0.5">{ev.comment}</p>}
                            <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                              <Clock size={11} />{formatDateTime(ev.createdAt)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </>
  )
}
