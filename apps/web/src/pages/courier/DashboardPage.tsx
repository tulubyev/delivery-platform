import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Package, TrendingUp, Star, Zap } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'

interface Stats {
  today:    { orders: number; earnings: number }
  week:     { orders: number; earnings: number }
  month:    { orders: number; earnings: number }
  active:   number
  rating:   number
  isOnline: boolean
}

type Period = 'today' | 'week' | 'month'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Сегодня' },
  { key: 'week',  label: '7 дней'  },
  { key: 'month', label: 'Месяц'   },
]

const fmt = (n: number) => new Intl.NumberFormat('ru-RU').format(Math.round(n))

export function CourierDashboardPage() {
  const { user } = useAuthStore()
  const [period, setPeriod] = useState<Period>('today')

  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ['courier', 'stats'],
    queryFn: async () => { const { data } = await api.get('/couriers/me/stats'); return data.data },
    refetchInterval: 60_000,
  })

  const s = stats?.[period]

  return (
    <div className="p-6 space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {getGreeting()}, {user?.name?.split(' ')[0]}!
          </h1>
          <p className="text-sm text-slate-500">Анализ вашей работы</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-2.5 w-2.5 rounded-full ${stats?.isOnline ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
          <span className="text-sm text-slate-600">{stats?.isOnline ? 'Онлайн' : 'Офлайн'}</span>
        </div>
      </div>

      {/* Переключатель периода */}
      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              period === p.key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Основные метрики */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Package}     color="blue"   label="Заказов выполнено" value={isLoading ? '...' : String(s?.orders ?? 0)}   unit="шт" />
        <StatCard icon={TrendingUp}  color="green"  label="Заработано"        value={isLoading ? '...' : fmt(s?.earnings ?? 0)}    unit="₽"  />
        <StatCard icon={Zap}         color="orange" label="Активных заказов"  value={isLoading ? '...' : String(stats?.active ?? 0)} unit="шт" />
        <StatCard icon={Star}        color="yellow" label="Рейтинг"           value={isLoading ? '...' : (stats?.rating ?? 0).toFixed(1)} unit="/ 5" />
      </div>

      {/* Сравнение периодов */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Сравнение периодов</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {PERIODS.map(p => (
                <div key={p.key} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <span className="text-sm text-slate-600 w-20">{p.label}</span>
                  <div className="flex-1 mx-4">
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all"
                        style={{ width: `${Math.min(100, (stats[p.key].orders / Math.max(1, stats.month.orders)) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-slate-900">{stats[p.key].orders} зак.</span>
                    <span className="ml-3 text-sm text-green-600 font-medium">{fmt(stats[p.key].earnings)} ₽</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Советы */}
      <Card className="border-blue-100 bg-blue-50">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="text-2xl">💡</div>
          <div>
            <p className="font-medium text-blue-900">Совет дня</p>
            <p className="text-sm text-blue-700 mt-0.5">
              Планируйте маршрут заранее на вкладке «Маршрут» — это экономит до 20% времени.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ icon: Icon, color, label, value, unit }: {
  icon: React.ElementType; color: string; label: string; value: string; unit: string
}) {
  const colors: Record<string, string> = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    yellow: 'bg-yellow-50 text-yellow-600',
  }
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${colors[color]}`}>
          <Icon size={18} />
        </div>
        <p className="mt-3 text-2xl font-bold text-slate-900">{value} <span className="text-sm font-normal text-slate-400">{unit}</span></p>
        <p className="mt-0.5 text-xs text-slate-500">{label}</p>
      </CardContent>
    </Card>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 6)  return 'Доброй ночи'
  if (h < 12) return 'Доброе утро'
  if (h < 18) return 'Добрый день'
  return 'Добрый вечер'
}
