import { useEffect, useRef, useState, useCallback } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useAlerts } from '@/queries/alerts'
import { useWebSocket } from '@/hooks/useWebSocket'
import { Badge } from '@/components/ui/badge'
import { Truck, AlertTriangle, Wifi, WifiOff, Navigation, Phone, MessageSquare, Send, X, Package } from 'lucide-react'
import { api } from '@/lib/api'
import { formatDateTime } from '@/lib/utils'

const TWOGIS_KEY = import.meta.env.VITE_TWOGIS_API_KEY ?? ''

const VEHICLE_COLOR: Record<string, string> = {
  BIKE: '#3b82f6', CAR: '#8b5cf6', MOTORCYCLE: '#f59e0b', FOOT: '#22c55e',
}
const STATUS_LABEL: Record<string, string> = {
  ASSIGNED: 'Назначен', PICKED_UP: 'Забрал', IN_TRANSIT: 'В пути',
}

interface ActiveOrder {
  id: string; number: string; status: string
  slaDeadlineAt: string | null; deliveryAddress: Record<string, string>
}
interface CourierRow {
  id: string; vehicleType: string | null; isOnline: boolean
  currentLat: number | null; currentLon: number | null; lastSeenAt: string | null
  user: { name: string; phone: string }
  orders: ActiveOrder[]
}

function markerHtml(index: number, color: string, selected: boolean, hasOrder: boolean) {
  return `<div style="
    background:${color};color:white;
    font-size:11px;font-weight:700;
    width:${selected ? 34 : 28}px;height:${selected ? 34 : 28}px;
    border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    border:${selected ? '3px' : '2px'} solid ${hasOrder ? '#f59e0b' : 'white'};
    box-shadow:0 2px 8px rgba(0,0,0,.4);
    cursor:pointer;transition:all .2s;
  ">${index}</div>`
}

function ContactPanel({ courier, onClose }: { courier: CourierRow; onClose: () => void }) {
  const [msg, setMsg] = useState('')
  const [sent, setSent] = useState<string | null>(null)

  const push = useMutation({
    mutationFn: (body: string) => api.post(`/notifications/couriers/${courier.id}/push`, {
      title: 'Сообщение от диспетчера', body,
    }),
    onSuccess: () => { setSent('push'); setMsg('') },
  })

  const notifyAdmin = useMutation({
    mutationFn: (body: string) => api.post('/notifications/admin/push', {
      title: `Курьер: ${courier.user.name}`, body,
    }),
    onSuccess: () => { setSent('admin'); setMsg('') },
  })

  return (
    <div className="border-t border-slate-100 p-3 space-y-2 bg-slate-50">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500 uppercase">Связь</p>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
      </div>

      {/* Call + SMS */}
      <div className="flex gap-2">
        <a href={`tel:${courier.user.phone}`}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-green-50 border border-green-200 py-2 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors">
          <Phone size={13} />Позвонить
        </a>
        <a href={`sms:${courier.user.phone}`}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-50 border border-blue-200 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors">
          <MessageSquare size={13} />SMS
        </a>
      </div>

      {/* Push message */}
      <div className="flex gap-1.5">
        <input
          className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Сообщение курьеру..."
          value={msg}
          onChange={e => setMsg(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && msg.trim()) push.mutate(msg) }}
        />
        <button
          disabled={!msg.trim() || push.isPending}
          onClick={() => push.mutate(msg)}
          className="flex items-center justify-center rounded-lg bg-blue-600 px-2.5 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors">
          <Send size={13} />
        </button>
      </div>

      {/* Notify org admin */}
      <button
        onClick={() => notifyAdmin.mutate(`Требуется внимание: курьер ${courier.user.name}`)}
        className="w-full rounded-lg border border-slate-200 bg-white py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors">
        📢 Уведомить орг-админа
      </button>

      {sent && (
        <p className="text-xs text-green-600 text-center">
          {sent === 'push' ? '✓ Push отправлен курьеру' : '✓ Уведомлен орг-админ'}
        </p>
      )}
    </div>
  )
}

export function MapPage() {
  const { data: initialCouriers, isLoading } = useQuery<CourierRow[]>({
    queryKey: ['couriers', 'all'],
    queryFn: async () => {
      const { data } = await api.get('/tracking/online')
      return data.data as CourierRow[]
    },
    refetchInterval: 15_000,
  })
  const { data: alerts } = useAlerts({ resolved: false })

  const mapRef    = useRef<HTMLDivElement>(null)
  const mapObjRef = useRef<unknown>(null)
  const [mapReady, setMapReady]   = useState(false)
  const [selected, setSelected]   = useState<string | null>(null)
  const [contact,  setContact]    = useState<string | null>(null)
  const [wsConnected, setWsConnected] = useState(false)
  const [couriers, setCouriers]   = useState<CourierRow[]>([])
  const markersRef = useRef<Map<string, unknown>>(new Map())

  useEffect(() => { if (initialCouriers) setCouriers(initialCouriers) }, [initialCouriers])

  const handleWsMessage = useCallback((event: {
    type: string
    payload: { courierId?: string; lat?: number; lon?: number; orderId?: string }
  }) => {
    if (event.type === 'COURIER_LOCATION' && event.payload.courierId) {
      const { courierId, lat, lon } = event.payload
      setCouriers(prev => prev.map(c =>
        c.id === courierId
          ? { ...c, currentLat: lat ?? c.currentLat, currentLon: lon ?? c.currentLon, isOnline: true, lastSeenAt: new Date().toISOString() }
          : c
      ))
    }
    if (event.type === 'ORDER_ASSIGNED' && event.payload.courierId) {
      // Перезапрашиваем список курьеров при новом назначении
      setCouriers(prev => [...prev]) // триггер перерисовки, данные обновятся при следующем poll
    }
  }, [])

  // @ts-ignore
  const { send } = useWebSocket(handleWsMessage)

  useEffect(() => {
    const t = setTimeout(() => { send({ type: 'SUBSCRIBE_ORG', payload: {} }); setWsConnected(true) }, 1000)
    return () => clearTimeout(t)
  }, [send])

  // Инициализация карты
  useEffect(() => {
    if (!mapRef.current || !TWOGIS_KEY) return
    let cancelled = false
    const defaultCenter: [number, number] = [37.6176, 55.7558]

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
        () => fetch('https://ipapi.co/json/').then(r => r.json())
          .then((d: { longitude?: number; latitude?: number }) =>
            !cancelled && init(d.longitude && d.latitude ? [d.longitude, d.latitude] : defaultCenter))
          .catch(() => !cancelled && init(defaultCenter)),
        { timeout: 4000 },
      )
    } else { init(defaultCenter) }

    return () => {
      cancelled = true
      markersRef.current.forEach((m: unknown) => { try { (m as { destroy(): void }).destroy() } catch { /* */ } })
      markersRef.current.clear()
    }
  }, [])

  // Маркеры
  useEffect(() => {
    // @ts-ignore
    if (!mapReady || !mapObjRef.current || !window.mapgl) return
    couriers.forEach((c, idx) => {
      if (!c.currentLon || !c.currentLat) return
      const color    = VEHICLE_COLOR[c.vehicleType ?? ''] ?? '#64748b'
      const hasOrder = c.orders.length > 0
      const html     = markerHtml(idx + 1, color, selected === c.id, hasOrder)
      const existing = markersRef.current.get(c.id)
      if (existing) {
        try {
          (existing as { setCoordinates(c: [number, number]): void }).setCoordinates([c.currentLon, c.currentLat]);
          (existing as { setHTML(h: string): void }).setHTML(html)
        } catch {
          try { (existing as { destroy(): void }).destroy() } catch { /* */ }
          markersRef.current.delete(c.id)
        }
      }
      if (!markersRef.current.has(c.id)) {
        // @ts-ignore
        const marker = new window.mapgl.HtmlMarker(mapObjRef.current, { coordinates: [c.currentLon, c.currentLat], html })
        markersRef.current.set(c.id, marker)
      }
    })
    markersRef.current.forEach((m, id) => {
      if (!couriers.find(c => c.id === id && c.currentLat)) {
        try { (m as { destroy(): void }).destroy() } catch { /* */ }
        markersRef.current.delete(id)
      }
    })
  }, [mapReady, couriers, selected])

  const focusCourier = (c: CourierRow) => {
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
  const assignedCount = couriers.filter(c => c.orders.length > 0).length

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="flex w-80 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-slate-900">Курьеры</h2>
            <div className={`flex items-center gap-1 text-xs ${wsConnected ? 'text-green-600' : 'text-slate-400'}`}>
              {wsConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
              {wsConnected ? 'Live' : '...'}
            </div>
          </div>
          <div className="flex gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" />{onlineCount} онлайн</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />{assignedCount} с заказом</span>
            <span>{couriers.length} всего</span>
            {criticalCount > 0 && <Badge variant="destructive" className="gap-1 h-4 px-1.5"><AlertTriangle size={10} />{criticalCount}</Badge>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {isLoading && Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse m-2 rounded-lg bg-slate-100" />
          ))}

          {!isLoading && couriers.length === 0 && (
            <div className="py-12 text-center text-slate-400">
              <Truck size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Курьеры не найдены</p>
            </div>
          )}

          {couriers.map((c, idx) => {
            const color    = VEHICLE_COLOR[c.vehicleType ?? ''] ?? '#64748b'
            const activeOrder = c.orders[0]
            const slaPassed   = activeOrder?.slaDeadlineAt && new Date(activeOrder.slaDeadlineAt) < new Date()
            const isSelected  = selected === c.id

            return (
              <div key={c.id}
                className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                <div className="p-3 flex items-start gap-3" onClick={() => focusCourier(c)}>
                  {/* Badge */}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold relative"
                    style={{ backgroundColor: color }}>
                    {idx + 1}
                    {activeOrder && (
                      <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-400 border border-white" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-slate-900">{c.user.name}</p>
                      <span className={`shrink-0 h-2 w-2 rounded-full ${c.isOnline ? 'bg-green-500' : 'bg-slate-300'}`} />
                    </div>
                    <p className="text-xs text-slate-500">{c.user.phone}</p>

                    {/* Active order */}
                    {activeOrder ? (
                      <div className={`mt-1.5 rounded-md px-2 py-1 text-xs ${slaPassed ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                        <div className="flex items-center gap-1 font-medium">
                          <Package size={11} />
                          #{activeOrder.number} — {STATUS_LABEL[activeOrder.status] ?? activeOrder.status}
                        </div>
                        {activeOrder.slaDeadlineAt && (
                          <div className="mt-0.5">
                            SLA: {new Date(activeOrder.slaDeadlineAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                            {slaPassed && ' ⚠️'}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-slate-400">
                        {c.isOnline ? 'Свободен' : c.lastSeenAt ? `Был: ${formatDateTime(c.lastSeenAt)}` : 'Офлайн'}
                      </p>
                    )}
                  </div>

                  {/* Contact toggle */}
                  <button
                    onClick={e => { e.stopPropagation(); setContact(contact === c.id ? null : c.id) }}
                    className={`shrink-0 rounded-lg p-1.5 transition-colors ${contact === c.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-100'}`}
                    title="Связь">
                    <Phone size={14} />
                  </button>
                </div>

                {contact === c.id && (
                  <ContactPanel courier={c} onClose={() => setContact(null)} />
                )}
              </div>
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
