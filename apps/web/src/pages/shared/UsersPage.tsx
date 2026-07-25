import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X, Trash2, AlertTriangle } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime } from '@/lib/utils'

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Суперадмин', ORG_ADMIN: 'Админ организации', SUPERVISOR: 'Диспетчер',
  COURIER: 'Курьер', CLIENT: 'Клиент',
}
const ROLE_COLOR: Record<string, string> = {
  ADMIN:     'bg-red-100 text-red-700',
  ORG_ADMIN: 'bg-purple-100 text-purple-700',
  SUPERVISOR:'bg-blue-100 text-blue-700',
  COURIER:   'bg-green-100 text-green-700',
  CLIENT:    'bg-slate-100 text-slate-700',
}

interface OrgRef { id: string; name: string }
interface UserCard {
  id: string; name: string; email: string; phone: string; role: string
  isActive: boolean; phoneVerified: boolean; organizationId: string | null
  createdAt: string; updatedAt: string
  organization: OrgRef | null
  courier: { id: string; type: string; vehicleType: string; verificationStatus: string; isOnline: boolean } | null
  client:  { id: string; companyName: string | null; inn: string | null } | null
}

function apiError(e: unknown, fallback = 'Ошибка') {
  return (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback
}

// ─── Общие хуки данных ────────────────────────────────────────────────────────

function useAssignableRoles() {
  return useQuery<string[]>({
    queryKey: ['users-meta'],
    queryFn: async () => (await api.get('/users/meta')).data.data.assignableRoles,
  })
}

function useOrganizations(enabled: boolean) {
  return useQuery<OrgRef[]>({
    queryKey: ['orgs-for-users'],
    enabled,
    queryFn: async () => {
      const { data } = await api.get('/organizations?limit=100')
      return (data.data.items as { id: string; name: string }[]).map(o => ({ id: o.id, name: o.name }))
    },
  })
}

// ─── Форма создания/редактирования ────────────────────────────────────────────

interface FormState {
  name: string; email: string; phone: string; password: string
  role: string; organizationId: string | null; isActive: boolean
  companyName: string; inn: string
}

function OrgSelect({ value, onChange, isPlatformAdmin, orgs }: {
  value: string | null; onChange: (v: string | null) => void
  isPlatformAdmin: boolean; orgs: OrgRef[]
}) {
  if (!isPlatformAdmin) return null
  return (
    <div>
      <Label>Организация</Label>
      <select
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
      >
        <option value="">— без организации (только Суперадмин) —</option>
        {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </div>
  )
}

function RoleSelect({ value, roles, onChange }: { value: string; roles: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>Роль *</Label>
      <select
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {roles.map(r => <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>)}
      </select>
    </div>
  )
}

function CreateUserModal({ onClose, roles, isPlatformAdmin }: {
  onClose: () => void; roles: string[]; isPlatformAdmin: boolean
}) {
  const qc = useQueryClient()
  const orgs = useOrganizations(isPlatformAdmin)
  const [form, setForm] = useState<FormState>({
    name: '', email: '', phone: '+7', password: '',
    role: roles[roles.length - 1] ?? 'COURIER', organizationId: null, isActive: true,
    companyName: '', inn: '',
  })
  const [error, setError] = useState('')

  const create = useMutation({
    mutationFn: () => api.post('/users', {
      name: form.name, email: form.email, phone: form.phone, password: form.password,
      role: form.role,
      organizationId: isPlatformAdmin ? form.organizationId : undefined,
      ...(form.role === 'CLIENT' ? { companyName: form.companyName || null, inn: form.inn || null } : {}),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users-list'] }); onClose() },
    onError: (e) => setError(apiError(e)),
  })

  const f = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const needsOrg = form.role !== 'ADMIN'
  const valid = form.name.length >= 2 && /\S+@\S+\.\S+/.test(form.email)
    && /^\+7\d{10}$/.test(form.phone) && form.password.length >= 8
    && (!isPlatformAdmin || !needsOrg || !!form.organizationId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-slate-900">Новый пользователь</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Имя *</Label><Input className="mt-1" placeholder="Иван Иванов" value={form.name} onChange={f('name')} /></div>
            <div><Label>Телефон *</Label><Input className="mt-1" placeholder="+79001234567" value={form.phone} onChange={f('phone')} /></div>
            <div><Label>Email *</Label><Input className="mt-1" type="email" placeholder="user@company.ru" value={form.email} onChange={f('email')} /></div>
            <div className="col-span-2"><Label>Пароль * (мин. 8 символов)</Label><Input className="mt-1" type="password" value={form.password} onChange={f('password')} /></div>
            <RoleSelect value={form.role} roles={roles} onChange={v => setForm(p => ({ ...p, role: v }))} />
            <OrgSelect value={form.organizationId} onChange={v => setForm(p => ({ ...p, organizationId: v }))} isPlatformAdmin={isPlatformAdmin} orgs={orgs.data ?? []} />
            {form.role === 'CLIENT' && (
              <>
                <div><Label>Компания</Label><Input className="mt-1" value={form.companyName} onChange={f('companyName')} /></div>
                <div><Label>ИНН</Label><Input className="mt-1" value={form.inn} onChange={f('inn')} /></div>
              </>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 sticky bottom-0 bg-white">
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button disabled={!valid || create.isPending} onClick={() => { setError(''); create.mutate() }}>
            {create.isPending ? 'Создание…' : 'Создать'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Карточка (просмотр + редактирование) ─────────────────────────────────────

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm text-slate-800 break-all">{value || '—'}</p>
    </div>
  )
}

function UserDrawer({ userId, onClose, roles, isPlatformAdmin, currentUserId }: {
  userId: string; onClose: () => void; roles: string[]; isPlatformAdmin: boolean; currentUserId: string
}) {
  const qc = useQueryClient()
  const orgs = useOrganizations(isPlatformAdmin)
  const [edit, setEdit] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [form, setForm] = useState<Partial<FormState>>({})

  const { data: u, isLoading } = useQuery<UserCard>({
    queryKey: ['user-card', userId],
    queryFn: async () => (await api.get(`/users/${userId}`)).data.data,
  })

  function startEdit() {
    if (!u) return
    setForm({
      name: u.name, email: u.email, phone: u.phone, role: u.role,
      organizationId: u.organizationId, isActive: u.isActive,
      companyName: u.client?.companyName ?? '', inn: u.client?.inn ?? '', password: '',
    })
    setEdit(true); setError('')
  }

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        name: form.name, email: form.email, phone: form.phone,
        role: form.role, isActive: form.isActive,
      }
      if (form.password) body.password = form.password
      if (isPlatformAdmin) body.organizationId = form.organizationId ?? null
      if (form.role === 'CLIENT') { body.companyName = form.companyName || null; body.inn = form.inn || null }
      return api.patch(`/users/${userId}`, body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users-list'] })
      qc.invalidateQueries({ queryKey: ['user-card', userId] })
      setEdit(false)
    },
    onError: (e) => setError(apiError(e)),
  })

  const del = useMutation({
    mutationFn: () => api.delete(`/users/${userId}`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['users-list'] })
      const d = res.data.data as { deleted: boolean; deactivated: boolean; reason?: string }
      if (d.deactivated) { qc.invalidateQueries({ queryKey: ['user-card', userId] }); setConfirmDelete(false); alert(d.reason ?? 'Учётная запись деактивирована') }
      else onClose()
    },
    onError: (e) => { setError(apiError(e)); setConfirmDelete(false) },
  })

  const f = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const isSelf = u?.id === currentUserId

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-y-auto bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-slate-900">Карточка пользователя</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
        </div>

        {isLoading || !u ? (
          <div className="space-y-3 p-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : !edit ? (
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">
                {u.name?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div>
                <p className="font-semibold text-slate-900">{u.name}</p>
                <span className={`inline-block mt-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLOR[u.role]}`}>{ROLE_LABEL[u.role] ?? u.role}</span>
              </div>
              {!u.isActive && <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Деактивирован</span>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Email" value={u.email} />
              <Field label="Телефон" value={u.phone} />
              <Field label="Организация" value={u.organization?.name} />
              <Field label="Телефон подтверждён" value={u.phoneVerified ? 'Да' : 'Нет'} />
              <Field label="Создан" value={formatDateTime(u.createdAt)} />
              <Field label="Обновлён" value={formatDateTime(u.updatedAt)} />
            </div>

            {u.client && (
              <div className="rounded-lg border border-slate-100 p-3 grid grid-cols-2 gap-3">
                <Field label="Компания" value={u.client.companyName} />
                <Field label="ИНН" value={u.client.inn} />
              </div>
            )}
            {u.courier && (
              <div className="rounded-lg border border-slate-100 p-3 grid grid-cols-2 gap-3">
                <Field label="Тип" value={u.courier.type} />
                <Field label="Транспорт" value={u.courier.vehicleType} />
                <Field label="Верификация" value={u.courier.verificationStatus} />
                <Field label="Онлайн" value={u.courier.isOnline ? 'Да' : 'Нет'} />
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-2 pt-2">
              <Button className="flex-1" onClick={startEdit}>Редактировать</Button>
              {!isSelf && (
                <Button variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => setConfirmDelete(true)}>
                  <Trash2 size={16} />
                </Button>
              )}
            </div>
            {isSelf && <p className="text-xs text-slate-400 text-center">Собственную учётную запись удалить нельзя</p>}
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Имя</Label><Input className="mt-1" value={form.name ?? ''} onChange={f('name')} /></div>
              <div><Label>Телефон</Label><Input className="mt-1" value={form.phone ?? ''} onChange={f('phone')} /></div>
              <div><Label>Email</Label><Input className="mt-1" value={form.email ?? ''} onChange={f('email')} /></div>
              <RoleSelect value={form.role ?? u.role} roles={roles} onChange={v => setForm(p => ({ ...p, role: v }))} />
              <OrgSelect value={form.organizationId ?? null} onChange={v => setForm(p => ({ ...p, organizationId: v }))} isPlatformAdmin={isPlatformAdmin} orgs={orgs.data ?? []} />
              {form.role === 'CLIENT' && (
                <>
                  <div><Label>Компания</Label><Input className="mt-1" value={form.companyName ?? ''} onChange={f('companyName')} /></div>
                  <div><Label>ИНН</Label><Input className="mt-1" value={form.inn ?? ''} onChange={f('inn')} /></div>
                </>
              )}
              <div className="col-span-2"><Label>Новый пароль (оставьте пустым, чтобы не менять)</Label><Input className="mt-1" type="password" value={form.password ?? ''} onChange={f('password')} /></div>
              <label className="col-span-2 flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.isActive ?? true} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} />
                Учётная запись активна
              </label>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEdit(false)}>Отмена</Button>
              <Button disabled={save.isPending} onClick={() => { setError(''); save.mutate() }}>
                {save.isPending ? 'Сохранение…' : 'Сохранить'}
              </Button>
            </div>
          </div>
        )}
      </div>

      {confirmDelete && u && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmDelete(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-amber-600 mb-2"><AlertTriangle size={20} /><h3 className="font-bold">Удалить пользователя?</h3></div>
            <p className="text-sm text-slate-600 mb-4">
              {u.name} ({ROLE_LABEL[u.role] ?? u.role}). Если у пользователя есть связанные заказы или журнал — учётная запись будет деактивирована, а не удалена полностью.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDelete(false)}>Отмена</Button>
              <Button className="bg-red-600 hover:bg-red-700" disabled={del.isPending} onClick={() => del.mutate()}>
                {del.isPending ? 'Удаление…' : 'Удалить'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Страница ─────────────────────────────────────────────────────────────────

export function UsersPage() {
  const currentUser = useAuthStore(s => s.user)
  const isPlatformAdmin = currentUser?.role === 'ADMIN'
  const [role, setRole]     = useState<string | undefined>()
  const [search, setSearch] = useState('')
  const [page, setPage]     = useState(1)
  const [creating, setCreating] = useState(false)
  const [openId, setOpenId]     = useState<string | null>(null)

  const rolesMeta = useAssignableRoles()
  const assignable = rolesMeta.data ?? []
  const filterRoles = isPlatformAdmin
    ? ['ADMIN', 'ORG_ADMIN', 'SUPERVISOR', 'COURIER', 'CLIENT']
    : assignable

  const { data, isLoading } = useQuery<{ items: UserCard[]; total: number }>({
    queryKey: ['users-list', role, search, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '30' })
      if (role)   params.set('role', role)
      if (search) params.set('search', search)
      return (await api.get(`/users?${params}`)).data.data
    },
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Пользователи</h1>
          <p className="text-sm text-slate-500">{data?.total ?? 0} всего</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Поиск по имени / email / телефону…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
          <Button onClick={() => setCreating(true)}><Plus size={16} className="mr-1" /> Добавить</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => { setRole(undefined); setPage(1) }}
          className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${!role ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
          Все
        </button>
        {filterRoles.map(r => (
          <button key={r} onClick={() => { setRole(r); setPage(1) }}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${role === r ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
            {ROLE_LABEL[r] ?? r}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    {['Имя', 'Email', 'Телефон', 'Роль', 'Организация', 'Статус', 'Создан'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map(u => (
                    <tr key={u.id} onClick={() => setOpenId(u.id)} className="border-b border-slate-50 hover:bg-blue-50/40 cursor-pointer">
                      <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                      <td className="px-4 py-3 text-slate-600">{u.email}</td>
                      <td className="px-4 py-3 text-slate-500">{u.phone}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLOR[u.role] ?? 'bg-slate-100 text-slate-600'}`}>{ROLE_LABEL[u.role] ?? u.role}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{u.organization?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        {u.isActive
                          ? <span className="text-green-600">● Активен</span>
                          : <span className="text-amber-500">● Деактивирован</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDateTime(u.createdAt)}</td>
                    </tr>
                  ))}
                  {!data?.items.length && (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">Пользователи не найдены</td></tr>
                  )}
                </tbody>
              </table>

              {data && data.total > 30 && (
                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                  <span className="text-sm text-slate-500">Страница {page} из {Math.ceil(data.total / 30)}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Назад</Button>
                    <Button variant="outline" size="sm" disabled={page * 30 >= data.total} onClick={() => setPage(p => p + 1)}>Далее</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {creating && <CreateUserModal onClose={() => setCreating(false)} roles={assignable} isPlatformAdmin={isPlatformAdmin} />}
      {openId && <UserDrawer userId={openId} onClose={() => setOpenId(null)} roles={assignable} isPlatformAdmin={isPlatformAdmin} currentUserId={currentUser?.id ?? ''} />}
    </div>
  )
}
