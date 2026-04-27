import { useEffect, useRef, useState } from 'react'
import { useOnlineCouriers } from '@/queries/couriers'
import { useAlerts } from '@/queries/alerts'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Truck, AlertTriangle, Wifi } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

// 2GIS MapGL будет подключён через CDN в index.html
// Здесь заглушка с курьерами в списке — карта подключается отдельно

export function MapPage() {
  const { data: couriers, isLoading } = useOnlineCouriers()
  const { data: alerts } = useAlerts({ resolved: false })
  const mapRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<string | null>(null)

  // Инициализация 2GIS карты (подключается через window.mapgl)
  useEffect(() => {
    // @ts-ignore
    if (!window.mapgl || !mapRef.current) return
    // @ts-ignore
    const map = new window.mapgl.Map(mapRef.current, {
      center: [82.9201, 55.0302], // Новосибирск по умолчанию
      zoom:   12,
      key:    import.meta.env.VITE_TWOGIS_API_KEY ?? '',
    })
    return () => map.destroy()
  }, [])

  const criticalCount = alerts?.items.filter((a: { severity: string }) => a.severity === 'CRITICAL').length ?? 0

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="flex w-72 flex-col border-r border-slate-200 bg-white">
        {/* Header */}
        <div className="border-b border-slate-100 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Онлайн курьеры</h2>
            <Badge variant={couriers?.length ? 'success' : 'default'}>{couriers?.length ?? 0}</Badge>
          </div>
          {criticalCount > 0 && (
            <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle size={14} />
              {criticalCount} критических алерта
            </div>
          )}
        </div>

        {/* Courier list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-sm text-slate-400">Загрузка...</div>
          ) : !couriers?.length ? (
            <div className="flex flex-col items-center gap-2 p-8 text-slate-400">
              <Truck size={32} />
              <p className="text-sm">Нет онлайн курьеров</p>
            </div>
          ) : (
            couriers.map(c => (
              <button
                key={c.id}
                onClick={() => setSelected(c.id === selected ? null : c.id)}
                className={`w-full border-b border-slate-50 p-3 text-left transition-colors hover:bg-slate-50 ${selected === c.id ? 'bg-blue-50' : ''}`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${c.isOnline ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    <Truck size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{c.user.name}</p>
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <Wifi size={10} className={c.isOnline ? 'text-green-500' : 'text-slate-300'} />
                      {c.lastSeenAt ? formatDateTime(c.lastSeenAt) : 'Нет данных'}
                    </div>
                  </div>
                  <div className="ml-auto">
                    <Badge variant={c.vehicleType === 'CAR' ? 'primary' : 'default'} className="text-[10px]">
                      {c.vehicleType}
                    </Badge>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Map container */}
      <div className="relative flex-1 bg-slate-100">
        <div ref={mapRef} className="h-full w-full" />
        {/* Placeholder until 2GIS loads */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400 pointer-events-none">
          <div className="rounded-xl bg-white/80 px-6 py-4 text-center shadow-sm backdrop-blur">
            <p className="font-medium text-slate-700">Карта 2GIS</p>
            <p className="mt-1 text-sm">Подключите VITE_TWOGIS_API_KEY в .env</p>
          </div>
        </div>
      </div>
    </div>
  )
}
