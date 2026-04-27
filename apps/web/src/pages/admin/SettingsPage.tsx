import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Bell, CreditCard, Building2 } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface TenantConfig {
  id: string
  slaMinutes: number
  agentCommissionPct: number
  yookassaShopId: string | null
  dispatchMode: string
  maxOffersPerOrder: number
  offerTimeoutSec: number
}

interface NotifTemplate { id: string; event: string; channel: string; template: string }

const DISPATCH_MODES = [
  { value: 'AUTO',        label: 'Авто' },
  { value: 'COMPETITIVE', label: 'Конкурентный' },
  { value: 'MANUAL',      label: 'Ручной' },
]

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon size={18} className="text-blue-600" />{title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  )
}

export function SettingsPage() {
  const qc = useQueryClient()
  const [saved, setSaved] = useState(false)

  const { data: config } = useQuery<TenantConfig>({
    queryKey: ['tenant-config'],
    queryFn: async () => { const { data } = await api.get('/config'); return data.data },
  })

  const [form, setForm] = useState({
    slaMinutes: 60,
    agentCommissionPct: 5,
    dispatchMode: 'AUTO',
    maxOffersPerOrder: 5,
    offerTimeoutSec: 30,
    yookassaShopId: '',
    yookassaSecretKey: '',
  })

  useEffect(() => {
    if (config) {
      setForm(f => ({
        ...f,
        slaMinutes: config.slaMinutes,
        agentCommissionPct: config.agentCommissionPct,
        dispatchMode: config.dispatchMode,
        maxOffersPerOrder: config.maxOffersPerOrder,
        offerTimeoutSec: config.offerTimeoutSec,
        yookassaShopId: config.yookassaShopId ?? '',
      }))
    }
  }, [config])

  const save = useMutation({
    mutationFn: () => api.patch('/config', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenant-config'] }); setSaved(true); setTimeout(() => setSaved(false), 2000) },
  })

  const { data: templates } = useQuery<NotifTemplate[]>({
    queryKey: ['notif-templates'],
    queryFn: async () => { const { data } = await api.get('/notifications/templates'); return data.data },
  })

  return (
    <div className="p-6 space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Настройки</h1>
        <p className="text-sm text-slate-500">Параметры организации</p>
      </div>

      <Section icon={Building2} title="Операционные параметры">
        <div>
          <Label>SLA (минуты)</Label>
          <Input type="number" className="mt-1 w-40" min={1} value={form.slaMinutes}
            onChange={e => setForm(f => ({ ...f, slaMinutes: parseInt(e.target.value) || 60 }))} />
        </div>
        <div>
          <Label>Режим диспетчеризации</Label>
          <select
            className="mt-1 w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.dispatchMode} onChange={e => setForm(f => ({ ...f, dispatchMode: e.target.value }))}>
            {DISPATCH_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3 max-w-xs">
          <div>
            <Label>Макс. предложений</Label>
            <Input type="number" className="mt-1" min={1} max={10} value={form.maxOffersPerOrder}
              onChange={e => setForm(f => ({ ...f, maxOffersPerOrder: parseInt(e.target.value) || 5 }))} />
          </div>
          <div>
            <Label>Таймаут оффера (с)</Label>
            <Input type="number" className="mt-1" min={10} max={120} value={form.offerTimeoutSec}
              onChange={e => setForm(f => ({ ...f, offerTimeoutSec: parseInt(e.target.value) || 30 }))} />
          </div>
        </div>
      </Section>

      <Section icon={CreditCard} title="Платежи (YooKassa)">
        <div>
          <Label>Комиссия агента (%)</Label>
          <Input type="number" className="mt-1 w-40" min={0} max={50} step={0.5} value={form.agentCommissionPct}
            onChange={e => setForm(f => ({ ...f, agentCommissionPct: parseFloat(e.target.value) || 5 }))} />
          <p className="mt-1 text-xs text-slate-400">Ваша комиссия с каждой доставки как агента</p>
        </div>
        <div>
          <Label>Shop ID</Label>
          <Input className="mt-1" placeholder="your_shop_id" value={form.yookassaShopId}
            onChange={e => setForm(f => ({ ...f, yookassaShopId: e.target.value }))} />
        </div>
        <div>
          <Label>Secret Key</Label>
          <Input type="password" className="mt-1" placeholder="••••••••" value={form.yookassaSecretKey}
            onChange={e => setForm(f => ({ ...f, yookassaSecretKey: e.target.value }))} />
          <p className="mt-1 text-xs text-slate-400">Оставьте пустым чтобы не изменять</p>
        </div>
      </Section>

      {templates && templates.length > 0 && (
        <Section icon={Bell} title="Шаблоны уведомлений">
          <div className="space-y-3">
            {templates.map(t => (
              <div key={t.id} className="rounded-lg bg-slate-50 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-slate-600">{t.event}</span>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">{t.channel}</span>
                </div>
                <p className="text-sm text-slate-700 font-mono">{t.template}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="flex items-center gap-3 pb-6">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save size={16} />{save.isPending ? 'Сохранение...' : 'Сохранить'}
        </Button>
        {saved && <span className="text-sm text-green-600 font-medium">Сохранено ✓</span>}
      </div>
    </div>
  )
}
