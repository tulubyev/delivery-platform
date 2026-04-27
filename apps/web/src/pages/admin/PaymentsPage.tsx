import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, FileText, TrendingUp, CreditCard, Percent } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime, formatMoney } from '@/lib/utils'

type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'CANCELLED' | 'REFUNDED'

interface Payment {
  id: string
  amount: number
  commissionAmt: number
  currency: string
  status: PaymentStatus
  orderId: string | null
  yookassaId: string | null
  createdAt: string
  order: { number: string } | null
}

interface AgentReport { id: string; periodStart: string; periodEnd: string; status: string; totalAmount: number; commissionAmount: number; createdAt: string }

const P_STATUS: Record<PaymentStatus, { label: string; variant: 'default'|'success'|'destructive'|'warning' }> = {
  PENDING:   { label: 'Ожидание',  variant: 'warning' },
  SUCCEEDED: { label: 'Оплачен',   variant: 'success' },
  CANCELLED: { label: 'Отменён',   variant: 'destructive' },
  REFUNDED:  { label: 'Возврат',   variant: 'default' },
}

function StatCard({ icon: Icon, title, value, sub, color = 'blue' }: { icon: React.ElementType; title: string; value: string; sub?: string; color?: string }) {
  const colors: Record<string, string> = { blue: 'bg-blue-50 text-blue-600', green: 'bg-green-50 text-green-600', amber: 'bg-amber-50 text-amber-600' }
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">{title}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
            {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
          </div>
          <div className={`rounded-xl p-3 ${colors[color]}`}><Icon size={22} /></div>
        </div>
      </CardContent>
    </Card>
  )
}

export function PaymentsPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'payments' | 'reports'>('payments')
  const [page, setPage] = useState(1)
  const [reportForm, setReportForm] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end:   new Date().toISOString().split('T')[0],
  })

  const { data: summary } = useQuery({
    queryKey: ['payments-summary'],
    queryFn: async () => { const { data } = await api.get('/payments/summary'); return data.data },
    refetchInterval: 60_000,
  })

  const { data: payments, isLoading: pLoading } = useQuery<{ items: Payment[]; total: number }>({
    queryKey: ['payments-list', page],
    queryFn: async () => { const { data } = await api.get('/payments', { params: { page, limit: 20 } }); return data.data },
    enabled: tab === 'payments',
  })

  const { data: reports, isLoading: rLoading } = useQuery<{ items: AgentReport[] }>({
    queryKey: ['agent-reports'],
    queryFn: async () => { const { data } = await api.get('/payments/agent-reports'); return data.data },
    enabled: tab === 'reports',
  })

  const generateReport = useMutation({
    mutationFn: () => api.post('/payments/agent-reports', { periodStart: reportForm.start, periodEnd: reportForm.end }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent-reports'] }),
  })

  async function downloadCsv(reportId: string) {
    const { data } = await api.get(`/payments/agent-reports/${reportId}/csv`, { responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([data]))
    const a = document.createElement('a')
    a.href = url; a.download = `agent-report-${reportId}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Платежи</h1>
        <p className="text-sm text-slate-500">YooKassa · Агентская схема</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={TrendingUp} title="Выручка (месяц)" value={formatMoney(summary?.revenue ?? 0)} color="green" />
        <StatCard icon={Percent}    title="Комиссия (месяц)" value={formatMoney(summary?.commission ?? 0)} sub={`${summary?.commissionPct ?? 0}%`} color="blue" />
        <StatCard icon={CreditCard} title="Платежей (месяц)" value={summary?.count ?? 0} color="amber" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
        {(['payments', 'reports'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t === 'payments' ? 'Платежи' : 'Агентские отчёты'}
          </button>
        ))}
      </div>

      {tab === 'payments' && (
        <Card>
          <CardContent className="p-0">
            {pLoading ? (
              <div className="space-y-2 p-4">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50">
                    <tr>
                      {['Заказ', 'Сумма', 'Комиссия', 'Статус', 'YooKassa ID', 'Дата'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {payments?.items.map(p => {
                      const s = P_STATUS[p.status]
                      return (
                        <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="px-4 py-3 font-mono font-medium text-blue-600">
                            {p.order ? `#${p.order.number}` : '—'}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-900">{formatMoney(p.amount)}</td>
                          <td className="px-4 py-3 text-slate-500">{formatMoney(p.commissionAmt)}</td>
                          <td className="px-4 py-3"><Badge variant={s.variant}>{s.label}</Badge></td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-400">{p.yookassaId ?? '—'}</td>
                          <td className="px-4 py-3 text-slate-500">{formatDateTime(p.createdAt)}</td>
                        </tr>
                      )
                    })}
                    {!payments?.items.length && (
                      <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">Платежи не найдены</td></tr>
                    )}
                  </tbody>
                </table>
                {payments && payments.total > 20 && (
                  <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                    <span className="text-sm text-slate-500">Страница {page} из {Math.ceil(payments.total / 20)}</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Назад</Button>
                      <Button variant="outline" size="sm" disabled={page * 20 >= payments.total} onClick={() => setPage(p => p + 1)}>Далее</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'reports' && (
        <div className="space-y-4">
          {/* Generate form */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Сформировать агентский отчёт</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600">С</label>
                  <input type="date" value={reportForm.start} onChange={e => setReportForm(f => ({ ...f, start: e.target.value }))}
                    className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">По</label>
                  <input type="date" value={reportForm.end} onChange={e => setReportForm(f => ({ ...f, end: e.target.value }))}
                    className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <Button onClick={() => generateReport.mutate()} disabled={generateReport.isPending}>
                  <FileText size={16} />Сформировать
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Reports list */}
          <Card>
            <CardContent className="p-0">
              {rLoading ? (
                <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50">
                    <tr>
                      {['Период', 'Сумма', 'Комиссия', 'Статус', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reports?.items.map(r => (
                      <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-700">
                          {new Date(r.periodStart).toLocaleDateString('ru-RU')} — {new Date(r.periodEnd).toLocaleDateString('ru-RU')}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">{formatMoney(r.totalAmount)}</td>
                        <td className="px-4 py-3 text-slate-500">{formatMoney(r.commissionAmount)}</td>
                        <td className="px-4 py-3"><Badge variant="success">{r.status}</Badge></td>
                        <td className="px-4 py-3">
                          <Button variant="outline" size="sm" onClick={() => downloadCsv(r.id)}>
                            <Download size={13} />CSV
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {!reports?.items.length && (
                      <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400">Отчётов нет</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
