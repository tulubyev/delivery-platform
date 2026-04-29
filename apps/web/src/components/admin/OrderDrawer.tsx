import { useState } from 'react'
import { X, UserCheck, Send, Clock } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  PICKED_UP:  ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['DELIVERED', 'FAILED', 'RETURNING'],
  RETURNING:  ['DELIVERED', 'FAILED'],
}

interface OrderDetail {
  id: string; number: string; status: string; notes: string | null
  recipientName: string; recipientPhone: string
  pickupAddress: Record<string, string>; deliveryAddress: Record<string, string>
  declaredValue: number | null; slaDeadlineAt: string | null; createdAt: string
  client: { companyName: string | null } | null
  courier: { id: string; user: { name: string; phone: string } } | null
  statusHistory: { id: string; status: string; createdAt: string; comment: string | null }[]
}

interface Props { orderId: string; onClose: () => void }

export function OrderDrawer({ orderId, onClose }: Props) {
  const qc = useQueryClient()
  const [msgTarget, setMsgTarget] = useState<'courier' | 'admin' | null>(null)
  const [msgText, setMsgText] = useState('')
  const [reassign, setReassign] = useState(false)
  const [newCourierId, setNewCourierId] = useState('')

  const { data: order, isLoading } = useQuery<OrderDetail>({
    queryKey: ['order-detail', orderId],
    queryFn: async () => {
      const { data } = await api.get(`/orders/${orderId}`)
      return data.data
    },
  })

  const { data: couriers } = useQuery<{ id: string; user: { name: string } }[]>({
    queryKey: ['couriers-select'],
    queryFn: async () => {
      const { data } = await api.get('/couriers')
      return data.data?.items ?? data.data ?? []
    },
    enabled: reassign,
  })

  const changeStatus = useMutation({
    mutationFn: (status: string) => api.patch(`/orders/${orderId}/status`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['order-detail', orderId] }) },
  })

  const assignCourier = useMutation({
    mutationFn: () => api.post(`/orders/${orderId}/assign`, { courierId: newCourierId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['order-detail', orderId] }); setReassign(false) },
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

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-lg bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg font-bold text-blue-600">
              {isLoading ? '...' : `#${order?.number}`}
            </span>
            {order && <Badge variant={STATUS_MAP[order.status]?.variant}>{STATUS_MAP[order.status]?.label ?? order.status}</Badge>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
          ) : order ? (
            <>
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase mb-1">Получатель</p>
                  <p className="font-medium text-slate-900">{order.recipientName}</p>
                  <p className="text-slate-500">{order.recipientPhone}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase mb-1">Клиент</p>
                  <p className="text-slate-700">{order.client?.companyName ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase mb-1">Откуда</p>
                  <p className="text-slate-700">{addr(order.pickupAddress)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase mb-1">Куда</p>
                  <p className="text-slate-700">{addr(order.deliveryAddress)}</p>
                </div>
                {order.declaredValue != null && (
                  <div>
                    <p className="text-xs font-medium text-slate-400 uppercase mb-1">Стоимость</p>
                    <p className="text-slate-700">{order.declaredValue.toLocaleString('ru')} ₽</p>
                  </div>
                )}
                {order.slaDeadlineAt && (
                  <div>
                    <p className="text-xs font-medium text-slate-400 uppercase mb-1">SLA</p>
                    <p className={new Date(order.slaDeadlineAt) < new Date() ? 'text-red-600 font-medium' : 'text-slate-700'}>
                      {formatDateTime(order.slaDeadlineAt)}
                    </p>
                  </div>
                )}
                {order.notes && (
                  <div className="col-span-2">
                    <p className="text-xs font-medium text-slate-400 uppercase mb-1">Примечание</p>
                    <p className="text-slate-700">{order.notes}</p>
                  </div>
                )}
              </div>

              {/* Courier */}
              <div className="rounded-xl border border-slate-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-slate-400 uppercase">Курьер</p>
                  <button onClick={() => setReassign(v => !v)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                    <UserCheck size={13} />{order.courier ? 'Переназначить' : 'Назначить'}
                  </button>
                </div>
                {order.courier ? (
                  <div>
                    <p className="font-medium text-slate-900">{order.courier.user.name}</p>
                    <p className="text-sm text-slate-500">{order.courier.user.phone}</p>
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm">Не назначен</p>
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
              </div>

              {/* Status change */}
              {STATUS_TRANSITIONS[order.status]?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase mb-2">Изменить статус</p>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_TRANSITIONS[order.status].map(s => (
                      <Button key={s} variant="outline" size="sm"
                        disabled={changeStatus.isPending}
                        onClick={() => changeStatus.mutate(s)}>
                        → {STATUS_MAP[s]?.label ?? s}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Message */}
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase mb-2">Отправить сообщение</p>
                <div className="flex gap-2 mb-2">
                  {order.courier && (
                    <button onClick={() => setMsgTarget(t => t === 'courier' ? null : 'courier')}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${msgTarget === 'courier' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                      Курьеру
                    </button>
                  )}
                  <button onClick={() => setMsgTarget(t => t === 'admin' ? null : 'admin')}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${msgTarget === 'admin' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                    Орг-админу
                  </button>
                </div>
                {msgTarget && (
                  <div className="flex gap-2">
                    <input
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={msgTarget === 'courier' ? 'Сообщение курьеру...' : 'Сообщение орг-админу...'}
                      value={msgText}
                      onChange={e => setMsgText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && msgText.trim()) sendMessage.mutate() }}
                    />
                    <Button size="sm" disabled={!msgText.trim() || sendMessage.isPending}
                      onClick={() => sendMessage.mutate()}>
                      <Send size={14} />
                    </Button>
                  </div>
                )}
                {sendMessage.isSuccess && (
                  <p className="text-xs text-green-600 mt-1">Сообщение отправлено</p>
                )}
              </div>

              {/* Timeline */}
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase mb-3">История</p>
                <div className="space-y-3">
                  {order.statusHistory.map((ev, i) => (
                    <div key={ev.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`h-2.5 w-2.5 rounded-full mt-0.5 ${i === order.statusHistory.length - 1 ? 'bg-blue-600' : 'bg-slate-300'}`} />
                        {i < order.statusHistory.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1" />}
                      </div>
                      <div className="pb-3">
                        <p className="text-sm font-medium text-slate-900">{STATUS_MAP[ev.status]?.label ?? ev.status}</p>
                        {ev.comment && <p className="text-xs text-slate-500">{ev.comment}</p>}
                        <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                          <Clock size={11} />{formatDateTime(ev.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </>
  )
}
