import { useQuery } from '@tanstack/react-query'
import { Truck, MapPin, Package, Star } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface OnlineCourier {
  id: string
  lat: number | null
  lon: number | null
  speed: number | null
  updatedAt: string | null
  courier: {
    id: string
    rating: number | null
    totalDeliveries: number
    user: { name: string; phone: string | null }
    activeOrders?: { id: string; number: string; status: string }[]
  }
}

const STATUS_LABELS: Record<string, string> = {
  ASSIGNED: 'Назначен', PICKED_UP: 'Забран', IN_TRANSIT: 'В пути',
}

export function SupervisorCouriersPage() {
  const { data: couriers, isLoading } = useQuery<OnlineCourier[]>({
    queryKey: ['online-couriers'],
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

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Курьеры онлайн</h1>
        <p className="text-sm text-slate-500">{couriers?.length ?? 0} активных · обновляется каждые 15с</p>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : couriers?.length === 0 ? (
        <div className="py-20 text-center text-slate-400">
          <Truck size={40} className="mx-auto mb-3 opacity-30" />
          <p>Нет курьеров онлайн</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {couriers?.map(c => (
            <Card key={c.id} className="border-l-4 border-l-green-500">
              <CardContent className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-green-700 text-sm font-bold">
                      {c.courier.user.name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{c.courier.user.name}</p>
                      {c.courier.user.phone && <p className="text-xs text-slate-400">{c.courier.user.phone}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-amber-600">
                    {c.courier.rating != null && (
                      <><Star size={11} className="fill-amber-400 text-amber-400" />{c.courier.rating.toFixed(1)}</>
                    )}
                  </div>
                </div>

                {/* Location */}
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <MapPin size={12} className="text-slate-400" />
                  {c.lat != null && c.lon != null
                    ? <span>{c.lat.toFixed(4)}, {c.lon.toFixed(4)}</span>
                    : <span>Координаты недоступны</span>}
                  {c.speed != null && c.speed > 0 && <span className="ml-1">· {Math.round(c.speed * 3.6)} км/ч</span>}
                </div>
                <p className="text-xs text-slate-400">Обновлено: {timeSince(c.updatedAt)}</p>

                {/* Active orders */}
                {c.courier.activeOrders && c.courier.activeOrders.length > 0 && (
                  <div className="space-y-1">
                    {c.courier.activeOrders.map(o => (
                      <div key={o.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                        <span className="flex items-center gap-1.5 text-xs font-medium text-blue-600">
                          <Package size={11} />#{o.number}
                        </span>
                        <span className="text-xs text-slate-500">{STATUS_LABELS[o.status] ?? o.status}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Stats */}
                <p className="text-xs text-slate-400">{c.courier.totalDeliveries} доставок всего</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
