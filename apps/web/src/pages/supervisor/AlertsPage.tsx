import { AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { useAlerts, useResolveAlert } from '@/queries/alerts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime } from '@/lib/utils'

const SEVERITY_VARIANT: Record<string, 'destructive'|'warning'|'default'> = {
  CRITICAL: 'destructive', HIGH: 'warning', MEDIUM: 'default', LOW: 'default',
}
const SEVERITY_LABEL: Record<string, string> = {
  CRITICAL: 'Критический', HIGH: 'Высокий', MEDIUM: 'Средний', LOW: 'Низкий',
}
const TYPE_LABEL: Record<string, string> = {
  COURIER_OFFLINE:    'Курьер офлайн',
  COURIER_STUCK:      'Курьер не двигается',
  ORDER_SLA_BREACH:   'SLA нарушен',
  DISPATCH_FAILED:    'Диспетчинг не удался',
  GEOFENCE_VIOLATION: 'Нарушение геозоны',
}

export function AlertsPage() {
  const { data, isLoading } = useAlerts({ resolved: false })
  const { mutate: resolve, isPending } = useResolveAlert()

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Алерты</h1>
          <p className="text-sm text-slate-500">{data?.total ?? 0} активных</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : !data?.items.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-slate-400">
            <CheckCircle size={40} className="text-green-400" />
            <p className="font-medium">Активных алертов нет</p>
            <p className="text-sm">Все процессы работают штатно</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.items.map((alert: { id: string; type: string; severity: string; message: string; createdAt: string; entityType: string }) => (
            <Card key={alert.id} className={alert.severity === 'CRITICAL' ? 'border-red-200' : alert.severity === 'HIGH' ? 'border-amber-200' : ''}>
              <CardContent className="flex items-start gap-4 p-4">
                <AlertTriangle size={18} className={
                  alert.severity === 'CRITICAL' ? 'text-red-500 shrink-0 mt-0.5' :
                  alert.severity === 'HIGH'     ? 'text-amber-500 shrink-0 mt-0.5' :
                  'text-slate-400 shrink-0 mt-0.5'
                } />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge variant={SEVERITY_VARIANT[alert.severity]}>{SEVERITY_LABEL[alert.severity]}</Badge>
                    <span className="text-sm font-medium text-slate-700">{TYPE_LABEL[alert.type] ?? alert.type}</span>
                  </div>
                  <p className="text-sm text-slate-600">{alert.message}</p>
                  <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                    <Clock size={12} />
                    {formatDateTime(alert.createdAt)}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => resolve(alert.id)}
                  className="shrink-0"
                >
                  Закрыть
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
