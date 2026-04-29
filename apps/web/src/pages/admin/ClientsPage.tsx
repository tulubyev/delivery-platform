import { useState } from 'react'
import { Plus, X, Building2, Landmark, FileText, User, ChevronRight, Phone, Mail, Globe } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'

interface ClientItem {
  id: string
  name: string; email: string; phone: string
  companyName: string | null; inn: string | null; kpp: string | null; ogrn: string | null
  legalAddress: string | null; contractNo: string | null; contractDate: string | null
  bankName: string | null; bankBik: string | null; bankAccount: string | null; bankCorAccount: string | null
  notes: string | null; webhookUrl: string | null; createdAt: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm text-slate-800 break-all">{value || '—'}</p>
    </div>
  )
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <Icon size={13} className="text-blue-500" />{title}
      </div>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  )
}

// ─── Create Modal ────────────────────────────────────────────────────────────

const emptyCreate = {
  name: '', email: '', phone: '+7', password: '',
  companyName: '', inn: '', kpp: '', ogrn: '', legalAddress: '',
  contractNo: '', contractDate: '',
  bankName: '', bankBik: '', bankAccount: '', bankCorAccount: '',
  notes: '',
}

function CreateClientModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState(emptyCreate)
  const [error, setError] = useState('')

  const create = useMutation({
    mutationFn: () => api.post('/clients', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-clients'] }); onClose() },
    onError: (e: unknown) => setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка'),
  })

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const valid = form.name && form.email && form.phone.length >= 12 && form.password.length >= 6

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-slate-900">Новый B2B клиент</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* Контакт */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <User size={12} /> Контактное лицо
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Имя *</Label><Input className="mt-1" placeholder="Иван Иванов" value={form.name} onChange={f('name')} /></div>
              <div><Label>Телефон *</Label><Input className="mt-1" placeholder="+79001234567" value={form.phone} onChange={f('phone')} /></div>
              <div><Label>Email *</Label><Input className="mt-1" type="email" placeholder="client@company.ru" value={form.email} onChange={f('email')} /></div>
              <div><Label>Пароль * (временный)</Label><Input className="mt-1" type="password" placeholder="Минимум 6 символов" value={form.password} onChange={f('password')} /></div>
            </div>
          </div>

          {/* Компания */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Building2 size={12} /> Реквизиты компании
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Название компании</Label><Input className="mt-1" placeholder="ООО Ромашка" value={form.companyName} onChange={f('companyName')} /></div>
              <div><Label>ИНН</Label><Input className="mt-1" placeholder="7700000000" value={form.inn} onChange={f('inn')} /></div>
              <div><Label>КПП</Label><Input className="mt-1" placeholder="770001001" value={form.kpp} onChange={f('kpp')} /></div>
              <div><Label>ОГРН / ОГРНИП</Label><Input className="mt-1" placeholder="1027700000000" value={form.ogrn} onChange={f('ogrn')} /></div>
              <div><Label>Номер договора</Label><Input className="mt-1" placeholder="Д-2024-001" value={form.contractNo} onChange={f('contractNo')} /></div>
              <div className="col-span-2"><Label>Юридический адрес</Label><Input className="mt-1" placeholder="г. Москва, ул. Примерная, д. 1" value={form.legalAddress} onChange={f('legalAddress')} /></div>
            </div>
          </div>

          {/* Банк */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Landmark size={12} /> Банковские реквизиты
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Банк</Label><Input className="mt-1" placeholder="ПАО Сбербанк" value={form.bankName} onChange={f('bankName')} /></div>
              <div><Label>БИК</Label><Input className="mt-1" placeholder="044525225" value={form.bankBik} onChange={f('bankBik')} /></div>
              <div><Label>Р/с</Label><Input className="mt-1" placeholder="40702810000000000000" value={form.bankAccount} onChange={f('bankAccount')} /></div>
              <div className="col-span-2"><Label>К/с</Label><Input className="mt-1" placeholder="30101810400000000225" value={form.bankCorAccount} onChange={f('bankCorAccount')} /></div>
            </div>
          </div>

          {/* Примечание */}
          <div>
            <Label>Примечание</Label>
            <textarea className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2} placeholder="Дополнительная информация..." value={form.notes} onChange={f('notes')} />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="flex gap-3 px-6 pb-6 sticky bottom-0 bg-white border-t border-slate-100 pt-4">
          <Button variant="outline" className="flex-1" onClick={onClose}>Отмена</Button>
          <Button className="flex-1" onClick={() => create.mutate()} disabled={!valid || create.isPending}>
            {create.isPending ? 'Создание...' : 'Создать клиента'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Edit Drawer ─────────────────────────────────────────────────────────────

function ClientDrawer({ client, onClose }: { client: ClientItem; onClose: () => void }) {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'view' | 'edit'>('view')
  const [form, setForm] = useState({
    name:           client.name,
    email:          client.email,
    phone:          client.phone,
    companyName:    client.companyName    ?? '',
    inn:            client.inn            ?? '',
    kpp:            client.kpp            ?? '',
    ogrn:           client.ogrn           ?? '',
    legalAddress:   client.legalAddress   ?? '',
    contractNo:     client.contractNo     ?? '',
    contractDate:   client.contractDate   ? client.contractDate.slice(0, 10) : '',
    bankName:       client.bankName       ?? '',
    bankBik:        client.bankBik        ?? '',
    bankAccount:    client.bankAccount    ?? '',
    bankCorAccount: client.bankCorAccount ?? '',
    notes:          client.notes          ?? '',
    webhookUrl:     client.webhookUrl     ?? '',
  })

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const [saved, setSaved] = useState(false)
  const save = useMutation({
    mutationFn: () => api.patch(`/clients/${client.id}`, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-clients'] })
      setSaved(true)
      setTimeout(() => { setSaved(false); setTab('view') }, 1500)
    },
  })

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-xl bg-white shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 shrink-0">
          <div>
            <p className="font-bold text-slate-900 text-lg">{client.companyName || client.name}</p>
            {client.companyName && <p className="text-sm text-slate-500">{client.name}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 shrink-0">
          {(['view', 'edit'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-medium transition-colors
                ${tab === t ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
              {t === 'view' ? 'Карточка' : 'Редактировать'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ── VIEW ── */}
          {tab === 'view' && (
            <>
              {/* Контакт */}
              <Section icon={User} title="Контактное лицо">
                <Field label="ФИО"   value={client.name} />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">Телефон</p>
                  <a href={`tel:${client.phone}`} className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
                    <Phone size={12} />{client.phone}
                  </a>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">Email</p>
                  <a href={`mailto:${client.email}`} className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
                    <Mail size={12} />{client.email}
                  </a>
                </div>
                <Field label="Создан" value={formatDateTime(client.createdAt)} />
              </Section>

              {/* Компания */}
              <Section icon={Building2} title="Реквизиты компании">
                <div className="col-span-2"><Field label="Название"      value={client.companyName} /></div>
                <Field label="ИНН"            value={client.inn} />
                <Field label="КПП"            value={client.kpp} />
                <Field label="ОГРН / ОГРНИП"  value={client.ogrn} />
                <Field label="Договор №"      value={client.contractNo} />
                {client.contractDate && (
                  <Field label="Дата договора" value={new Date(client.contractDate).toLocaleDateString('ru')} />
                )}
                {client.legalAddress && (
                  <div className="col-span-2"><Field label="Юр. адрес" value={client.legalAddress} /></div>
                )}
              </Section>

              {/* Банк */}
              {(client.bankName || client.bankBik || client.bankAccount) ? (
                <Section icon={Landmark} title="Банковские реквизиты">
                  <div className="col-span-2"><Field label="Банк"  value={client.bankName} /></div>
                  <Field label="БИК"  value={client.bankBik} />
                  <Field label="Р/с"  value={client.bankAccount} />
                  {client.bankCorAccount && (
                    <div className="col-span-2"><Field label="К/с" value={client.bankCorAccount} /></div>
                  )}
                </Section>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center">
                  <Landmark size={20} className="mx-auto mb-1.5 text-slate-300" />
                  <p className="text-sm text-slate-400">Банковские реквизиты не заполнены</p>
                  <button onClick={() => setTab('edit')} className="mt-1.5 text-xs text-blue-500 hover:underline">Добавить</button>
                </div>
              )}

              {/* Договор и прочее */}
              {(client.notes || client.webhookUrl) && (
                <Section icon={FileText} title="Дополнительно">
                  {client.notes && <div className="col-span-2"><Field label="Примечание" value={client.notes} /></div>}
                  {client.webhookUrl && (
                    <div className="col-span-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">Webhook</p>
                      <a href={client.webhookUrl} target="_blank" rel="noreferrer"
                         className="flex items-center gap-1 text-xs text-blue-600 hover:underline break-all">
                        <Globe size={11} />{client.webhookUrl}
                      </a>
                    </div>
                  )}
                </Section>
              )}
            </>
          )}

          {/* ── EDIT ── */}
          {tab === 'edit' && (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <User size={12} /> Контактное лицо
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Имя</Label><Input className="mt-1" value={form.name} onChange={f('name')} /></div>
                  <div><Label>Телефон</Label><Input className="mt-1" value={form.phone} onChange={f('phone')} /></div>
                  <div className="col-span-2"><Label>Email</Label><Input className="mt-1" type="email" value={form.email} onChange={f('email')} /></div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <Building2 size={12} /> Реквизиты компании
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><Label>Название компании</Label><Input className="mt-1" value={form.companyName} onChange={f('companyName')} /></div>
                  <div><Label>ИНН</Label><Input className="mt-1" value={form.inn} onChange={f('inn')} /></div>
                  <div><Label>КПП</Label><Input className="mt-1" value={form.kpp} onChange={f('kpp')} /></div>
                  <div><Label>ОГРН / ОГРНИП</Label><Input className="mt-1" value={form.ogrn} onChange={f('ogrn')} /></div>
                  <div><Label>Номер договора</Label><Input className="mt-1" value={form.contractNo} onChange={f('contractNo')} /></div>
                  <div><Label>Дата договора</Label><Input className="mt-1" type="date" value={form.contractDate} onChange={f('contractDate')} /></div>
                  <div className="col-span-2"><Label>Юридический адрес</Label><Input className="mt-1" value={form.legalAddress} onChange={f('legalAddress')} /></div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <Landmark size={12} /> Банковские реквизиты
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><Label>Банк</Label><Input className="mt-1" placeholder="ПАО Сбербанк" value={form.bankName} onChange={f('bankName')} /></div>
                  <div><Label>БИК</Label><Input className="mt-1" placeholder="044525225" value={form.bankBik} onChange={f('bankBik')} /></div>
                  <div><Label>Расчётный счёт (Р/с)</Label><Input className="mt-1" placeholder="40702810..." value={form.bankAccount} onChange={f('bankAccount')} /></div>
                  <div className="col-span-2"><Label>Корреспондентский счёт (К/с)</Label><Input className="mt-1" placeholder="30101810..." value={form.bankCorAccount} onChange={f('bankCorAccount')} /></div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <FileText size={12} /> Дополнительно
                </p>
                <div className="space-y-3">
                  <div>
                    <Label>Примечание</Label>
                    <textarea className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3} value={form.notes} onChange={f('notes')} />
                  </div>
                  <div>
                    <Label>Webhook URL</Label>
                    <Input className="mt-1" placeholder="https://..." value={form.webhookUrl} onChange={f('webhookUrl')} />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pb-4">
                <Button className="flex-1" onClick={() => save.mutate()} disabled={save.isPending}>
                  {save.isPending ? 'Сохранение...' : saved ? '✓ Сохранено' : 'Сохранить'}
                </Button>
                <Button variant="outline" onClick={() => setTab('view')}>Отмена</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function ClientsPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState<ClientItem | null>(null)

  const { data, isLoading } = useQuery<ClientItem[]>({
    queryKey: ['admin-clients'],
    queryFn: async () => { const { data } = await api.get('/clients/list'); return data.data ?? [] },
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Клиенты</h1>
          <p className="text-sm text-slate-500">{data?.length ?? 0} B2B клиентов</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={16} />Новый клиент
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  {['Клиент / Компания', 'Контакты', 'ИНН', 'Банк', 'Договор', 'Создан', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.map(c => (
                  <tr key={c.id}
                    className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer"
                    onClick={() => setSelected(c)}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{c.companyName || c.name}</p>
                      {c.companyName && <p className="text-xs text-slate-400">{c.name}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-600">{c.phone}</p>
                      <p className="text-xs text-slate-400">{c.email}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{c.inn ?? '—'}</td>
                    <td className="px-4 py-3">
                      {c.bankName
                        ? <Badge variant="default" className="text-xs">{c.bankName}</Badge>
                        : <span className="text-slate-300 text-xs">не заполнен</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{c.contractNo ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{formatDateTime(c.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-300">
                      <ChevronRight size={16} />
                    </td>
                  </tr>
                ))}
                {!data?.length && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">Клиентов нет. Создайте первого.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {showCreate && <CreateClientModal onClose={() => setShowCreate(false)} />}
      {selected && <ClientDrawer client={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
