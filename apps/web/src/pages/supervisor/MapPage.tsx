import { useEffect, useRef, useState } from 'react'
import { useOnlineCouriers, Courier } from '@/queries/couriers'
import { useAlerts } from '@/queries/alerts'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Truck, AlertTriangle, Wifi } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

const TWOGIS_KEY = import.meta.env.VITE_TWOGIS_API_KEY ?? ''

export function MapPage() {
  const { data: couriers, isLoading } = useOnlineCouriers()
  const { data: alerts } = useAlerts({ resolved: false })
  const mapRef    = useRef<HTMLDivElement>(null)
  const mapObjRef = useRef<unknown>(null)
  const [mapReady, setMapReady] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  // Инициализация 2GIS карты с автолокацией
  useEffect(() => {
    if (!mapRef.current || !TWOGIS_KEY) return

    let cancelled = false

    const initMap = (center: [number, number]) => {
      // @ts-ignore
      if (!window.mapgl) { setTimeout(() => initMap(center), 200); return }
      if (cancelled || !mapRef.current) return
      // @ts-ignore
      const map = new window.mapgl.Map(mapRef.current, { center, zoom: 11, key: TWOGIS_KEY })
      mapObjRef.current = map
      setMapReady(true)
    }

    const defaultCenter: [number, number] = [37.6176, 55.7558] // Москва

    // 1. Пробуем GPS
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => !cancelled && initMap([pos.coords.longitude, pos.coords.latitude]),
        () => {
          // 2. Fallback: IP геолокация
          fetch('https://ipapi.co/json/')
            .then(r => r.json())
            .then((d: { longitude?: number; latitude?: number }) =>
              !cancelled && initMap(d.longitude && d.latitude ? [d.longitude, d.latitude] : defaultCenter))
            .catch(() => !cancelled && initMap(defaultCenter))
        },
        { timeout: 5000 },
      )
    } else {
      initMap(defaultCenter)
    }

    return () => { cancelled = true }
  }, [])

  // Добавляем маркеры курьеров
  useEffect(() => {
    // @ts-ignore
    if (!mapReady || !mapObjRef.current || !window.mapgl || !couriers) return
    couriers.forEach((c: Courier) => {
      if (!c.currentLon || !c.currentLat) return
      // @ts-ignore
      new window.mapgl.Marker(mapObjRef.current, {
        coordinates: [c.currentLon, c.currentLat],
      })
    })
  }, [mapReady, couriers])

  const criticalCount = alerts?.items?.filter((a: { severity: string }) => a.severity === 'CRITICAL').length ?? 0

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="flex w-72 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Онлайн курьеры</h2>
            {criticalCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle size={12} /> {criticalCount}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoading && <p className="text-sm text-slate-400 text-center py-4">Загрузка...</p>}
          {couriers?.map((c: Courier) => (
            <Card
              key={c.id}
              className={`cursor-pointer transition-colors ${selected === c.id ? 'ring-2 ring-blue-500' : ''}`}
              onClick={() => setSelected(c.id)}
            >
              <CardContent className="p-3 flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${c.isOnline ? 'bg-green-100' : 'bg-slate-100'}`}>
                  <Truck size={14} className={c.isOnline ? 'text-green-600' : 'text-slate-400'} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{c.user.name}</p>
                  <p className="text-xs text-slate-400">
                    {c.isOnline
                      ? <span className="flex items-center gap-1 text-green-600"><Wifi size={10} />Онлайн</span>
                      : c.lastSeenAt ? formatDateTime(c.lastSeenAt) : 'Офлайн'}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </aside>

      {/* Map */}
      <div className="relative flex-1 bg-slate-100">
        <div ref={mapRef} className="h-full w-full" />
        {!TWOGIS_KEY && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="rounded-xl bg-white/90 px-6 py-4 text-center shadow">
              <p className="font-medium text-slate-700">Карта 2GIS</p>
              <p className="mt-1 text-sm text-slate-400">Задайте VITE_TWOGIS_API_KEY при сборке</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
