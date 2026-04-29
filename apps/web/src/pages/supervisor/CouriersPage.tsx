import { useQuery } from '@tanstack/react-query'
import { Truck, MapPin, Package, Star, Phone, Wifi, WifiOff } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface ActiveOrder {
  id: string
  number: string
  status: string
  slaDeadlineAt: string | null
  deliveryAddress: Record<string, string>
}

interface CourierRow {
  id: string
  vehicleType: string | null
  isOnline: boolean
  currentLat: number | null
  currentLon: number | null
  lastSeenAt: string | null
  user: { name: string; phone: string | null }
  orders: ActiveOrder[]
}

const STATUS_LABELS: Record<string, string> = {
  ASSIGNED: 'Назначен', PICKED_UP: 'Забран', IN_TRANSIT: 'В пути',
}

const VEHICLE_LABELS: Record<string, string> = {
  FOOT: '🚶', BICYCLE: '🚲', SCOOTER: '🛵', CAR: '🚗', VAN: '🚐',
}

export function SupervisorCouriersPage() {
  const { data: couriers, isLoading } = useQuery<CourierRow[]>({
    queryKey: ['all-couriers'],
    queryFn: async () => { const { data } = await api.get('/tracking/online'); return data.data },
    refetchInterval: 15_000,
  })

  const now = new Date()

  function timeSince(ts: string | null) {
    if (!ts) return '—'
    const sec = Math.floor((now.getTime() - new Date(ts).getTime()) / 1000)
    if (sec < 60) return `${sec}с назад`
    if (sec < 3600) return `${Math.floor(sec / 60)}м назад`
    return `${Math.floor(sec / 3600)}ч назад`
  }

  const online  = couriers?.filter(c => c.isOnline).length ?? 0
  const withOrder = couriers?.filter(c => c.orders.length > 0).length ?? 0
  const total   = couriers?.length ?? 0

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Все курьеры</h1>
          <p className="text-sm text-slate-500">
            <span className="text-green-600 font-medium">{online} онлайн</span>
            {' · '}{withOrder} с заказом
            {' · '}{total} всего
            {' · '}обновляется каждые 15с
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : !couriers?.length ? (
        <div className="py-20 text-center text-slate-400">
          <Truck size={40} className="mx-auto mb-3 opacity-30" />
          <p>Курьеров нет</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {couriers.map(c => (
            <Card key={c.id} className={`border-l-4 ${c.isOnline ? 'border-l-green-500' : 'border-l-slate-300'}`}>
              <CardContent className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold
                      ${c.isOnline ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {c.user.name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{c.user.name}</p>
                      {c.user.phone && (
                        <a href={`tel:${c.user.phone}`}
                           className="flex items-center gap-1 text-xs text-blue-500 hover:underline">
                          <Phone size={10} />{c.user.phone}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className={`flex items-center gap-1 text-xs ${c.isOnline ? 'text-green-600' : 'text-slate-400'}`}>
                      {c.isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
                      {c.isOnline ? 'Онлайн' : 'Офлайн'}
                    </div>
                    {c.vehicleType && (
                      <span className="text-sm">{VEHICLE_LABELS[c.vehicleType] ?? c.vehicleType}</span>
                    )}
                  </div>
                </div>

                {/* Location */}
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <MapPin size={12} className="text-slate-400 shrink-0" />
                  {c.currentLat != null && c.currentLon != null
                    ? <span>{c.currentLat.toFixed(4)}, {c.currentLon.toFixed(4)}</span>
                    : <span>Координаты недоступны</span>}
                </div>
                <p className="text-xs text-slate-400">Активность: {timeSince(c.lastSeenAt)}</p>

                {/* Active orders */}
                {c.orders.length > 0 ? (
                  <div className="space-y-1">
                    {c.orders.map(o => {
                      const slaExpired = o.slaDeadlineAt && new Date(o.slaDeadlineAt) < now
                      return (
                        <div key={o.id} className="rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-2 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                              <Package size={11} />#{o.number}
                            </span>
                            <span className="text-xs text-slate-600 bg-white border border-slate-200 rounded px-1.5 py-0.5">
                              {STATUS_LABELS[o.status] ?? o.status}
                            </span>
                          </div>
                          {o.slaDeadlineAt && (
                            <p className={`text-xs ${slaExpired ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                              SLA: {new Date(o.slaDeadlineAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                              {slaExpired && ' ⚠️ просрочен'}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Нет активных заказов</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
