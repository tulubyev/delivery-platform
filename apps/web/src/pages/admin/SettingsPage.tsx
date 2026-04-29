import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Bell, CreditCard, Building2, FileText, Settings2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface TenantConfig {
  id: string; slaMinutes: number; agentCommissionPct: number
  yookassaShopId: string | null; dispatchMode: string
  maxOffersPerOrder: number; offerTimeoutSec: number
}

interface OrgProfile {
  id: string; name: string; slug: string; inn: string | null
  kpp: string | null; ogrn: string | null; legalAddress: string | null
  phone: string | null; email: string | null; website: string | null
  contractNo: string | null; contractDate: string | null; logoUrl: string | null
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
  const { user } = useAuthStore()
  const orgId = user?.organizationId
  const [savedConfig, setSavedConfig] = useState(false)
  const [savedOrg, setSavedOrg] = useState(false)

  // ── Tenant config ─────────────────────────────────────────────────────────
  const { data: config } = useQuery<TenantConfig>({
    queryKey: ['tenant-config'],
    queryFn: async () => { const { data } = await api.get('/config'); return data.data },
  })

  const [configForm, setConfigForm] = useState({
    slaMinutes: 60, agentCommissionPct: 5, dispatchMode: 'AUTO',
    maxOffersPerOrder: 5, offerTimeoutSec: 30,
    yookassaShopId: '', yookassaSecretKey: '',
  })

  useEffect(() => {
    if (config) setConfigForm(f => ({
      ...f,
      slaMinutes: config.slaMinutes,
      agentCommissionPct: config.agentCommissionPct,
      dispatchMode: config.dispatchMode,
      maxOffersPerOrder: config.maxOffersPerOrder,
      offerTimeoutSec: config.offerTimeoutSec,
      yookassaShopId: config.yookassaShopId ?? '',
    }))
  }, [config])

  const saveConfig = useMutation({
    mutationFn: () => api.patch('/config', configForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenant-config'] }); setSavedConfig(true); setTimeout(() => setSavedConfig(false), 2500) },
  })

  // ── Org profile ───────────────────────────────────────────────────────────
  const { data: org } = useQuery<OrgProfile>({
    queryKey: ['org-profile', orgId],
    queryFn: async () => { const { data } = await api.get(`/organizations/${orgId}`); return data.data },
    enabled: !!orgId,
  })

  const [orgForm, setOrgForm] = useState({
    name: '', inn: '', kpp: '', ogrn: '', legalAddress: '',
    phone: '', email: '', website: '', contractNo: '', contractDate: '',
  })

  useEffect(() => {
    if (org) setOrgForm({
      name:         org.name         ?? '',
      inn:          org.inn          ?? '',
      kpp:          org.kpp          ?? '',
      ogrn:         org.ogrn         ?? '',
      legalAddress: org.legalAddress ?? '',
      phone:        org.phone        ?? '',
      email:        org.email        ?? '',
      website:      org.website      ?? '',
      contractNo:   org.contractNo   ?? '',
      contractDate: org.contractDate ? org.contractDate.slice(0, 10) : '',
    })
  }, [org])

  const saveOrg = useMutation({
    mutationFn: () => api.patch(`/organizations/${orgId}`, {
      ...orgForm,
      contractDate: orgForm.contractDate || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['org-profile', orgId] }); setSavedOrg(true); setTimeout(() => setSavedOrg(false), 2500) },
  })

  // ── Notif templates ───────────────────────────────────────────────────────
  const { data: templates } = useQuery<NotifTemplate[]>({
    queryKey: ['notif-templates'],
    queryFn: async () => { const { data } = await api.get('/notifications/templates'); return data.data },
  })

  return (
    <div className="p-6 space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Настройки</h1>
        <p className="text-sm text-slate-500">Профиль организации и операционные параметры</p>
      </div>

      {/* ── Реквизиты организации ── */}
      <Section icon={Building2} title="Реквизиты организации">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Название организации</Label>
            <Input className="mt-1" value={orgForm.name}
              onChange={e => setOrgForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <Label>ИНН</Label>
            <Input className="mt-1" placeholder="1234567890" value={orgForm.inn}
              onChange={e => setOrgForm(f => ({ ...f, inn: e.target.value }))} />
          </div>
          <div>
            <Label>КПП</Label>
            <Input className="mt-1" placeholder="123456789" value={orgForm.kpp}
              onChange={e => setOrgForm(f => ({ ...f, kpp: e.target.value }))} />
          </div>
          <div>
            <Label>ОГРН / ОГРНИП</Label>
            <Input className="mt-1" placeholder="1234567890123" value={orgForm.ogrn}
              onChange={e => setOrgForm(f => ({ ...f, ogrn: e.target.value }))} />
          </div>
          <div>
            <Label>Телефон</Label>
            <Input className="mt-1" placeholder="+7 (xxx) xxx-xx-xx" value={orgForm.phone}
              onChange={e => setOrgForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div>
            <Label>Email</Label>
            <Input className="mt-1" type="email" placeholder="info@company.ru" value={orgForm.email}
              onChange={e => setOrgForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <Label>Сайт</Label>
            <Input className="mt-1" placeholder="https://company.ru" value={orgForm.website}
              onChange={e => setOrgForm(f => ({ ...f, website: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <Label>Юридический адрес</Label>
            <Input className="mt-1" placeholder="г. Москва, ул. Примерная, д. 1" value={orgForm.legalAddress}
              onChange={e => setOrgForm(f => ({ ...f, legalAddress: e.target.value }))} />
          </div>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <Button onClick={() => saveOrg.mutate()} disabled={saveOrg.isPending || !orgId}>
            <Save size={15} />{saveOrg.isPending ? 'Сохранение...' : 'Сохранить реквизиты'}
          </Button>
          {savedOrg && <span className="text-sm text-green-600 font-medium">Сохранено ✓</span>}
        </div>
      </Section>

      {/* ── Договор ── */}
      <Section icon={FileText} title="Договор с платформой">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Номер договора</Label>
            <Input className="mt-1" placeholder="ДОГ-2024-001" value={orgForm.contractNo}
              onChange={e => setOrgForm(f => ({ ...f, contractNo: e.target.value }))} />
          </div>
          <div>
            <Label>Дата договора</Label>
            <Input className="mt-1" type="date" value={orgForm.contractDate}
              onChange={e => setOrgForm(f => ({ ...f, contractDate: e.target.value }))} />
          </div>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <Button onClick={() => saveOrg.mutate()} disabled={saveOrg.isPending || !orgId} variant="outline">
            <Save size={15} />{saveOrg.isPending ? 'Сохранение...' : 'Сохранить'}
          </Button>
          {savedOrg && <span className="text-sm text-green-600 font-medium">Сохранено ✓</span>}
        </div>
      </Section>

      {/* ── Операционные параметры ── */}
      <Section icon={Settings2} title="Операционные параметры">
        <div>
          <Label>SLA (минуты)</Label>
          <Input type="number" className="mt-1 w-40" min={1} value={configForm.slaMinutes}
            onChange={e => setConfigForm(f => ({ ...f, slaMinutes: parseInt(e.target.value) || 60 }))} />
        </div>
        <div>
          <Label>Режим диспетчеризации</Label>
          <select
            className="mt-1 w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={configForm.dispatchMode} onChange={e => setConfigForm(f => ({ ...f, dispatchMode: e.target.value }))}>
            {DISPATCH_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3 max-w-xs">
          <div>
            <Label>Макс. предложений</Label>
            <Input type="number" className="mt-1" min={1} max={10} value={configForm.maxOffersPerOrder}
              onChange={e => setConfigForm(f => ({ ...f, maxOffersPerOrder: parseInt(e.target.value) || 5 }))} />
          </div>
          <div>
            <Label>Таймаут оффера (с)</Label>
            <Input type="number" className="mt-1" min={10} max={120} value={configForm.offerTimeoutSec}
              onChange={e => setConfigForm(f => ({ ...f, offerTimeoutSec: parseInt(e.target.value) || 30 }))} />
          </div>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <Button onClick={() => saveConfig.mutate()} disabled={saveConfig.isPending}>
            <Save size={15} />{saveConfig.isPending ? 'Сохранение...' : 'Сохранить параметры'}
          </Button>
          {savedConfig && <span className="text-sm text-green-600 font-medium">Сохранено ✓</span>}
        </div>
      </Section>

      {/* ── Платежи ── */}
      <Section icon={CreditCard} title="Платежи (YooKassa)">
        <div>
          <Label>Комиссия агента (%)</Label>
          <Input type="number" className="mt-1 w-40" min={0} max={50} step={0.5} value={configForm.agentCommissionPct}
            onChange={e => setConfigForm(f => ({ ...f, agentCommissionPct: parseFloat(e.target.value) || 5 }))} />
          <p className="mt-1 text-xs text-slate-400">Ваша комиссия с каждой доставки как агента</p>
        </div>
        <div>
          <Label>Shop ID</Label>
          <Input className="mt-1" placeholder="your_shop_id" value={configForm.yookassaShopId}
            onChange={e => setConfigForm(f => ({ ...f, yookassaShopId: e.target.value }))} />
        </div>
        <div>
          <Label>Secret Key</Label>
          <Input type="password" className="mt-1" placeholder="••••••••" value={configForm.yookassaSecretKey}
            onChange={e => setConfigForm(f => ({ ...f, yookassaSecretKey: e.target.value }))} />
          <p className="mt-1 text-xs text-slate-400">Оставьте пустым чтобы не изменять</p>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <Button onClick={() => saveConfig.mutate()} disabled={saveConfig.isPending} variant="outline">
            <Save size={15} />{saveConfig.isPending ? 'Сохранение...' : 'Сохранить платёжные настройки'}
          </Button>
        </div>
      </Section>

      {/* ── Шаблоны уведомлений ── */}
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
    </div>
  )
}
