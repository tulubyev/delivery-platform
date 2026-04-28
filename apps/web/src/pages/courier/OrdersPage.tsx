import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Search, Package, MapPin, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

interface Order {
  id: string
  status: string
  recipientName: string
  recipientPhone: string
  deliveryAddress: string
  declaredValue: number | null
  createdAt: string
  deliveredAt: string | null
  pickupPoint?: { address: string } | null
}

const STATUS_LABEL: Record<string, string> = {
  PENDING:    'Ожидает',
  ASSIGNED:   'Назначен',
  PICKED_UP:  'Забран',
  IN_TRANSIT: 'В пути',
  DELIVERED:  'Доставлен',
  CANCELLED:  'Отменён',
  FAILED:     'Провалено',
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  DELIVERED: 'default',
  CANCELLED: 'destructive',
  FAILED:    'destructive',
  PENDING:   'secondary',
}

export function CourierOrdersPage() {
  const [search, setSearch]   = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading } = useQuery<{ items: Order[]; total: number }>({
    queryKey: ['courier', 'orders', statusFilter],
    queryFn: async () => {
      const { data } = await api.get('/orders', {
        params: { limit: 100, ...(statusFilter ? { status: statusFilter } : {}) },
      })
      return data.data
    },
  })

  const orders = data?.items ?? []
  const filtered = orders.filter(o =>
    !search || o.recipientName?.toLowerCase().includes(search.toLowerCase()) ||
    o.deliveryAddress?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Мои заказы</h1>
        <p className="text-sm text-slate-500">{data?.total ?? 0} заказов всего</p>
      </div>

      {/* Фильтры */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Поиск по адресу или клиенту..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">Все статусы</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Список */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-slate-400">
          <Package size={40} className="mx-auto mb-3 opacity-30" />
          <p>Заказов не найдено</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(o => (
            <Card key={o.id} className="overflow-hidden">
              <CardContent className="p-0">
                <button
                  className="w-full text-left p-4 hover:bg-slate-50 transition-colors"
                  onClick={() => setExpanded(expanded === o.id ? null : o.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={STATUS_VARIANT[o.status] ?? 'secondary'} className="text-xs">
                          {STATUS_LABEL[o.status] ?? o.status}
                        </Badge>
                        <span className="text-xs text-slate-400">{formatDateTime(o.createdAt)}</span>
                      </div>
                      <p className="mt-1 font-medium text-slate-900 truncate">{o.recipientName}</p>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <MapPin size={11} />
                        <span className="truncate">{o.deliveryAddress}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {o.declaredValue != null && (
                        <span className="text-sm font-semibold text-green-600">{o.declaredValue} ₽</span>
                      )}
                      {expanded === o.id ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </div>
                  </div>
                </button>

                {expanded === o.id && (
                  <div className="border-t border-slate-100 px-4 py-3 bg-slate-50 space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-slate-600">
                      <span className="font-medium w-28">Телефон:</span>
                      <a href={`tel:${o.recipientPhone}`} className="text-blue-600 hover:underline">{o.recipientPhone}</a>
                    </div>
                    {o.pickupPoint && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <span className="font-medium w-28">Откуда:</span>
                        <span>{o.pickupPoint.address}</span>
                      </div>
                    )}
                    {o.deliveredAt && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Clock size={13} />
                        <span>Доставлен: {formatDateTime(o.deliveredAt)}</span>
                      </div>
                    )}
                    {o.status === 'CANCELLED' && (
                      <div className="flex items-center gap-2 text-red-500">
                        <Clock size={13} />
                        <span>Заказ отменён</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
