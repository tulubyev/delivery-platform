import { useEffect, useRef, useState, useCallback } from 'react'
import { useOnlineCouriers, Courier } from '@/queries/couriers'
import { useAlerts } from '@/queries/alerts'
import { useWebSocket } from '@/hooks/useWebSocket'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Truck, AlertTriangle, Wifi, WifiOff, Navigation } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

const TWOGIS_KEY = import.meta.env.VITE_TWOGIS_API_KEY ?? ''

// Цвета по типу транспорта
const VEHICLE_COLOR: Record<string, string> = {
  BIKE:       '#3b82f6',
  CAR:        '#8b5cf6',
  MOTORCYCLE: '#f59e0b',
  FOOT:       '#22c55e',
}

function markerHtml(index: number, color: string, selected: boolean) {
  return `<div style="
    background:${color};color:white;
    font-size:11px;font-weight:700;
    width:${selected ? 32 : 26}px;height:${selected ? 32 : 26}px;
    border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    border:${selected ? '3px' : '2px'} solid white;
    box-shadow:0 2px 6px rgba(0,0,0,.35);
    cursor:pointer;
    transition:all .2s;
  ">${index}</div>`
}

export function MapPage() {
  const { data: initialCouriers, isLoading } = useOnlineCouriers()
  const { data: alerts } = useAlerts({ resolved: false })

  const mapRef    = useRef<HTMLDivElement>(null)
  const mapObjRef = useRef<unknown>(null)
  const [mapReady, setMapReady] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [wsConnected, setWsConnected] = useState(false)

  // Локальное состояние курьеров — обновляется через WS
  const [couriers, setCouriers] = useState<Courier[]>([])

  // Маркеры на карте: courierId → HtmlMarker instance
  const markersRef = useRef<Map<string, unknown>>(new Map())

  // Синхронизируем couriers при первой загрузке
  useEffect(() => {
    if (initialCouriers) setCouriers(initialCouriers)
  }, [initialCouriers])

  // WebSocket — подписываемся на org-канал
  const handleWsMessage = useCallback((event: { type: string; payload: { courierId?: string; lat?: number; lon?: number } }) => {
    if (event.type === 'COURIER_LOCATION' && event.payload.courierId) {
      const { courierId, lat, lon } = event.payload
      setCouriers(prev => prev.map(c =>
        c.id === courierId
          ? { ...c, currentLat: lat ?? c.currentLat, currentLon: lon ?? c.currentLon, isOnline: true, lastSeenAt: new Date().toISOString() }
          : c
      ))
    }
  }, [])

  // @ts-ignore
  const { send } = useWebSocket(handleWsMessage)

  // При подключении WS подписываемся на org-канал
  useEffect(() => {
    const timer = setTimeout(() => {
      send({ type: 'SUBSCRIBE_ORG', payload: {} })
      setWsConnected(true)
    }, 1000)
    return () => clearTimeout(timer)
  }, [send])

  // Инициализация карты
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

    const defaultCenter: [number, number] = [37.6176, 55.7558]

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => !cancelled && initMap([pos.coords.longitude, pos.coords.latitude]),
        () => {
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

    return () => {
      cancelled = true
      markersRef.current.forEach((m: unknown) => { try { (m as { destroy(): void }).destroy() } catch { /* */ } })
      markersRef.current.clear()
    }
  }, [])

  // Обновляем маркеры при изменении курьеров или selected
  useEffect(() => {
    // @ts-ignore
    if (!mapReady || !mapObjRef.current || !window.mapgl) return

    couriers.forEach((c, idx) => {
      if (!c.currentLon || !c.currentLat) return
      const color = VEHICLE_COLOR[c.vehicleType] ?? '#3b82f6'
      const html  = markerHtml(idx + 1, color, selected === c.id)

      const existing = markersRef.current.get(c.id)
      if (existing) {
        // Обновляем позицию и HTML существующего маркера
        try {
          (existing as { setCoordinates(c: [number, number]): void }).setCoordinates([c.currentLon, c.currentLat]);
          (existing as { setHTML(h: string): void }).setHTML(html)
        } catch {
          // Некоторые версии не поддерживают setHTML — пересоздаём
          try { (existing as { destroy(): void }).destroy() } catch { /* */ }
          markersRef.current.delete(c.id)
        }
      }

      if (!markersRef.current.has(c.id)) {
        // @ts-ignore
        const marker = new window.mapgl.HtmlMarker(mapObjRef.current, {
          coordinates: [c.currentLon, c.currentLat],
          html,
        })
        markersRef.current.set(c.id, marker)
      }
    })

    // Удаляем маркеры курьеров которых больше нет онлайн
    markersRef.current.forEach((m, id) => {
      if (!couriers.find(c => c.id === id && c.currentLat)) {
        try { (m as { destroy(): void }).destroy() } catch { /* */ }
        markersRef.current.delete(id)
      }
    })
  }, [mapReady, couriers, selected])

  // При клике на карточку — центрируем карту на курьере
  const focusCourier = (c: Courier) => {
    setSelected(c.id)
    if (c.currentLon && c.currentLat && mapObjRef.current) {
      try {
        // @ts-ignore
        mapObjRef.current.setCenter([c.currentLon, c.currentLat])
        // @ts-ignore
        mapObjRef.current.setZoom(15)
      } catch { /* */ }
    }
  }

  const criticalCount = alerts?.items?.filter((a: { severity: string }) => a.severity === 'CRITICAL').length ?? 0
  const onlineCount   = couriers.filter(c => c.isOnline).length

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="flex w-72 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Курьеры онлайн</h2>
              <p className="text-xs text-slate-400 mt-0.5">{onlineCount} активных</p>
            </div>
            <div className="flex items-center gap-2">
              {criticalCount > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle size={12} />{criticalCount}
                </Badge>
              )}
              <div className={`flex items-center gap-1 text-xs ${wsConnected ? 'text-green-600' : 'text-slate-400'}`}>
                {wsConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
                {wsConnected ? 'Live' : '...'}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          )}

          {!isLoading && couriers.length === 0 && (
            <div className="py-12 text-center text-slate-400">
              <Truck size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Нет онлайн курьеров</p>
            </div>
          )}

          {couriers.map((c, idx) => {
            const color = VEHICLE_COLOR[c.vehicleType] ?? '#3b82f6'
            return (
              <Card
                key={c.id}
                className={`cursor-pointer transition-all ${selected === c.id ? 'ring-2 ring-blue-500' : 'hover:shadow-sm'}`}
                onClick={() => focusCourier(c)}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  {/* Numbered circle */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold"
                    style={{ backgroundColor: color }}>
                    {idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{c.user.name}</p>
                    <p className="text-xs text-slate-400">
                      {c.isOnline
                        ? <span className="flex items-center gap-1 text-green-600"><Wifi size={10} />Онлайн</span>
                        : c.lastSeenAt ? formatDateTime(c.lastSeenAt) : 'Офлайн'}
                    </p>
                  </div>
                  {c.currentLat && (
                    <Navigation size={14} className="text-slate-400 shrink-0" />
                  )}
                </CardContent>
              </Card>
            )
          })}
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
