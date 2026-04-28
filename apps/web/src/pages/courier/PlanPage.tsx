import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapPin, Clock, Navigation, Calendar } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

const TWOGIS_KEY = import.meta.env.VITE_TWOGIS_API_KEY ?? ''

interface PlanOrder {
  id: string
  status: string
  recipientName: string
  deliveryAddress: string
  deliveryLat?: number | null
  deliveryLon?: number | null
  createdAt: string
  pickupPoint?: { address: string; lat?: number | null; lon?: number | null } | null
}

const STATUS_COLOR: Record<string, string> = {
  PENDING:    '#f59e0b',
  ASSIGNED:   '#3b82f6',
  PICKED_UP:  '#8b5cf6',
  IN_TRANSIT: '#06b6d4',
  DELIVERED:  '#22c55e',
  CANCELLED:  '#ef4444',
}

export function CourierPlanPage() {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)

  const mapRef    = useRef<HTMLDivElement>(null)
  const mapObjRef = useRef<unknown>(null)
  const [mapReady, setMapReady] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  const { data: orders = [], isLoading } = useQuery<PlanOrder[]>({
    queryKey: ['courier', 'plan', date],
    queryFn: async () => {
      const { data } = await api.get('/couriers/me/plan', { params: { date } })
      return data.data
    },
  })

  // Инициализация карты
  useEffect(() => {
    if (!mapRef.current || !TWOGIS_KEY) return
    let cancelled = false

    const init = (center: [number, number]) => {
      // @ts-ignore
      if (!window.mapgl) { setTimeout(() => init(center), 200); return }
      if (cancelled || !mapRef.current) return
      // @ts-ignore
      const map = new window.mapgl.Map(mapRef.current, { center, zoom: 11, key: TWOGIS_KEY })
      mapObjRef.current = map
      setMapReady(true)
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        p => !cancelled && init([p.coords.longitude, p.coords.latitude]),
        () => !cancelled && init([37.6176, 55.7558]),
        { timeout: 4000 },
      )
    } else {
      init([37.6176, 55.7558])
    }

    return () => {
      cancelled = true
      if (mapObjRef.current) {
        // @ts-ignore
        mapObjRef.current.destroy()
        mapObjRef.current = null
        setMapReady(false)
      }
    }
  }, [])

  // Маркеры заказов
  useEffect(() => {
    // @ts-ignore
    if (!mapReady || !mapObjRef.current || !window.mapgl) return
    orders.forEach((o, idx) => {
      if (!o.deliveryLon || !o.deliveryLat) return
      // @ts-ignore
      new window.mapgl.HtmlMarker(mapObjRef.current, {
        coordinates: [o.deliveryLon, o.deliveryLat],
        html: `<div style="
          background:${STATUS_COLOR[o.status] ?? '#3b82f6'};
          color:white;font-size:11px;font-weight:600;
          width:24px;height:24px;border-radius:50%;
          display:flex;align-items:center;justify-content:center;
          border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3);
          cursor:pointer;">${idx + 1}</div>`,
      })
    })
  }, [mapReady, orders])

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="flex w-80 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-4 space-y-3">
          <h2 className="font-semibold text-slate-900">Планирование маршрута</h2>
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-slate-400" />
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <p className="text-xs text-slate-400">{orders.length} заказов на дату</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          )}

          {!isLoading && orders.length === 0 && (
            <div className="py-12 text-center text-slate-400">
              <Navigation size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">На эту дату заказов нет</p>
            </div>
          )}

          {orders.map((o, idx) => (
            <Card key={o.id}
              className={`cursor-pointer transition-all ${selected === o.id ? 'ring-2 ring-blue-500' : 'hover:shadow-sm'}`}
              onClick={() => setSelected(selected === o.id ? null : o.id)}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold"
                    style={{ backgroundColor: STATUS_COLOR[o.status] ?? '#3b82f6' }}>
                    {idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{o.recipientName}</p>
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                      <MapPin size={10} />
                      <span className="truncate">{o.deliveryAddress}</span>
                    </div>
                    {selected === o.id && o.pickupPoint && (
                      <div className="mt-1 rounded bg-slate-50 p-2 text-xs text-slate-500 space-y-0.5">
                        <p><span className="font-medium">Откуда:</span> {o.pickupPoint.address}</p>
                        <div className="flex items-center gap-1">
                          <Clock size={10} />
                          <span>{formatDateTime(o.createdAt)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0" style={{ color: STATUS_COLOR[o.status] }}>
                    #{idx + 1}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Итог */}
        {orders.length > 0 && (
          <div className="border-t border-slate-100 p-4">
            <div className="rounded-lg bg-blue-50 p-3 text-center">
              <p className="text-sm font-semibold text-blue-900">{orders.length} доставок</p>
              <p className="text-xs text-blue-600 mt-0.5">на {new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</p>
            </div>
          </div>
        )}
      </aside>

      {/* Карта */}
      <div className="relative flex-1">
        <div ref={mapRef} className="h-full w-full" />
        {!TWOGIS_KEY && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
            <div className="rounded-xl bg-white px-6 py-4 text-center shadow">
              <p className="font-medium text-slate-700">Карта 2GIS</p>
              <p className="mt-1 text-sm text-slate-400">Задайте VITE_TWOGIS_API_KEY при сборке</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
