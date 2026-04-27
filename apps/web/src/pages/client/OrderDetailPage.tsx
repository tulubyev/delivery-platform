import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ExternalLink, MapPin, User, Package, Truck, Clock } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime } from '@/lib/utils'

const STATUS_MAP: Record<string, { label: string; variant: 'default'|'primary'|'success'|'warning'|'destructive' }> = {
  CREATED:    { label: 'Создан',       variant: 'default' },
  ASSIGNED:   { label: 'Назначен',     variant: 'primary' },
  PICKED_UP:  { label: 'Забран',       variant: 'warning' },
  IN_TRANSIT: { label: 'В пути',       variant: 'warning' },
  DELIVERED:  { label: 'Доставлен',    variant: 'success' },
  CANCELLED:  { label: 'Отменён',      variant: 'destructive' },
  FAILED:     { label: 'Не доставлен', variant: 'destructive' },
}

const TIMELINE: { status: string; label: string; icon: React.ElementType }[] = [
  { status: 'CREATED',    label: 'Заказ создан',         icon: Package },
  { status: 'ASSIGNED',   label: 'Курьер назначен',      icon: Truck },
  { status: 'PICKED_UP',  label: 'Забран со склада',     icon: MapPin },
  { status: 'IN_TRANSIT', label: 'В пути к получателю',  icon: Truck },
  { status: 'DELIVERED',  label: 'Доставлен',            icon: Package },
]

const STATUS_ORDER = ['CREATED','ASSIGNED','PICKED_UP','IN_TRANSIT','DELIVERED']

interface OrderDetail {
  id: string; number: string; status: string
  pickupAddress: Record<string,string>; deliveryAddress: Record<string,string>
  recipientName: string; recipientPhone?: string
  weight?: number; declaredValue?: number; notes?: string
  slaDeadlineAt: string|null; createdAt: string; scheduledAt: string|null
  trackingToken: string|null
  courier?: { user: { name: string; phone?: string } } | null
  statusHistory?: { status: string; createdAt: string; comment?: string }[]
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 py-1.5 text-sm">
      <span className="w-36 shrink-0 text-slate-400">{label}</span>
      <span className="text-slate-900">{value}</span>
    </div>
  )
}

export function ClientOrderDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data: order, isLoading } = useQuery<OrderDetail>({
    queryKey: ['order-detail', id],
    queryFn: async () => { const { data } = await api.get(`/orders/${id}`); return data.data },
    refetchInterval: 20_000,
  })

  if (isLoading) return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
      </div>
    </div>
  )

  if (!order) return <div className="p-6 text-slate-400">Заказ не найден</div>

  const s = STATUS_MAP[order.status]
  const slaPassed = order.slaDeadlineAt && new Date(order.slaDeadlineAt) < new Date()
  const currentIdx = STATUS_ORDER.indexOf(order.status)
  const isFailed = ['CANCELLED','FAILED'].includes(order.status)

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link to="/client/orders" className="mb-2 flex items-center gap-1 text-sm text-slate-500 hover:text-blue-600">
            <ArrowLeft size={14} />Назад
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 font-mono">#{order.number}</h1>
          <p className="text-sm text-slate-500 mt-1">Создан {formatDateTime(order.createdAt)}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={s?.variant} className="text-sm px-3 py-1">{s?.label ?? order.status}</Badge>
          {order.trackingToken && (
            <a href={`/track/${order.trackingToken}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100">
              <ExternalLink size={13} />Отследить
            </a>
          )}
        </div>
      </div>

      {/* Timeline */}
      {!isFailed && (
        <Card>
          <CardContent className="py-5">
            <div className="flex items-center">
              {TIMELINE.map((step, i) => {
                const done    = currentIdx >= i
                const current = currentIdx === i
                const Icon    = step.icon
                return (
                  <div key={step.status} className="flex flex-1 items-center">
                    <div className="flex flex-col items-center gap-1">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors
                        ${done ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-300'}
                        ${current ? 'ring-2 ring-blue-200 ring-offset-1' : ''}`}>
                        <Icon size={14} />
                      </div>
                      <span className={`text-center text-[10px] leading-tight max-w-[60px] ${done ? 'text-blue-700 font-medium' : 'text-slate-400'}`}>
                        {step.label}
                      </span>
                    </div>
                    {i < TIMELINE.length - 1 && (
                      <div className={`h-0.5 flex-1 mx-1 rounded ${currentIdx > i ? 'bg-blue-600' : 'bg-slate-200'}`} />
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Addresses */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm"><MapPin size={14} className="text-blue-600" />Адреса</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase mb-1">Забор</p>
              <p className="text-sm text-slate-900">{Object.values(order.pickupAddress).filter(Boolean).join(', ')}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase mb-1">Доставка</p>
              <p className="text-sm text-slate-900">{Object.values(order.deliveryAddress).filter(Boolean).join(', ')}</p>
            </div>
          </CardContent>
        </Card>

        {/* Recipient */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm"><User size={14} className="text-blue-600" />Получатель</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="Имя" value={order.recipientName} />
            {order.recipientPhone && <InfoRow label="Телефон" value={order.recipientPhone} />}
          </CardContent>
        </Card>

        {/* Parcel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm"><Package size={14} className="text-blue-600" />Посылка</CardTitle>
          </CardHeader>
          <CardContent>
            {order.weight        && <InfoRow label="Вес" value={`${order.weight} кг`} />}
            {order.declaredValue && <InfoRow label="Объявл. стоимость" value={`${order.declaredValue.toLocaleString('ru-RU')} ₽`} />}
            {order.notes         && <InfoRow label="Примечание" value={order.notes} />}
            {!order.weight && !order.declaredValue && !order.notes && (
              <p className="text-sm text-slate-400">Нет данных</p>
            )}
          </CardContent>
        </Card>

        {/* Courier + SLA */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm"><Truck size={14} className="text-blue-600" />Курьер и сроки</CardTitle>
          </CardHeader>
          <CardContent>
            {order.courier
              ? <InfoRow label="Курьер" value={order.courier.user.name} />
              : <InfoRow label="Курьер" value={<span className="text-slate-400">Ещё не назначен</span>} />}
            {order.slaDeadlineAt && (
              <InfoRow label="SLA" value={
                <span className={slaPassed ? 'font-medium text-red-600' : ''}>
                  {formatDateTime(order.slaDeadlineAt)} {slaPassed && '⚠ просрочен'}
                </span>
              } />
            )}
            {order.scheduledAt && <InfoRow label="Запланирован" value={formatDateTime(order.scheduledAt)} />}
          </CardContent>
        </Card>
      </div>

      {/* Status history */}
      {order.statusHistory && order.statusHistory.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm"><Clock size={14} className="text-blue-600" />История статусов</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {order.statusHistory.map((h, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-blue-400 mt-2" />
                  <div>
                    <span className="font-medium text-slate-900">{STATUS_MAP[h.status]?.label ?? h.status}</span>
                    <span className="ml-2 text-slate-400">{formatDateTime(h.createdAt)}</span>
                    {h.comment && <p className="text-slate-500">{h.comment}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
