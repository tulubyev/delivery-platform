import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime } from '@/lib/utils'

interface OrgOption { id: string; name: string }
interface AdminUser { id: string; name: string; email: string; role: string; organizationId: string | null; createdAt: string; organization?: { name: string } }

function CreateAdminModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: '', email: '', phone: '+7', password: '', organizationId: '' })
  const [error, setError] = useState('')

  const { data: orgs } = useQuery<OrgOption[]>({
    queryKey: ['superadmin-orgs-select'],
    queryFn: async () => {
      const { data } = await api.get('/organizations')
      return data.data?.items ?? []
    },
  })

  const create = useMutation({
    mutationFn: () => api.post('/superadmin/admins', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['superadmin-admins'] }); onClose() },
    onError: (e: unknown) => {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка создания')
    },
  })

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const valid = form.name && form.email && form.phone.length >= 12 && form.password.length >= 6 && form.organizationId

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Новый ORG_ADMIN</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <Label>Организация</Label>
            <select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.organizationId} onChange={f('organizationId')}>
              <option value="">Выберите организацию</option>
              {orgs?.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Имя</Label>
            <Input className="mt-1" placeholder="Иван Иванов" value={form.name} onChange={f('name')} />
          </div>
          <div>
            <Label>Email</Label>
            <Input className="mt-1" type="email" placeholder="admin@company.ru" value={form.email} onChange={f('email')} />
          </div>
          <div>
            <Label>Телефон</Label>
            <Input className="mt-1" placeholder="+79001234567" value={form.phone} onChange={f('phone')} />
          </div>
          <div>
            <Label>Пароль</Label>
            <Input className="mt-1" type="password" placeholder="Минимум 6 символов" value={form.password} onChange={f('password')} />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="flex gap-3 p-6 pt-0">
          <Button variant="outline" className="flex-1" onClick={onClose}>Отмена</Button>
          <Button className="flex-1" disabled={!valid || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? 'Создание...' : 'Создать'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function SuperAdminUsersPage() {
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading } = useQuery<AdminUser[]>({
    queryKey: ['superadmin-admins'],
    queryFn: async () => {
      const { data } = await api.get('/superadmin/admins')
      return data.data ?? []
    },
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Администраторы</h1>
          <p className="text-sm text-slate-500">{data?.length ?? 0} всего</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={16} />Новый ORG_ADMIN
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  {['Имя', 'Email', 'Роль', 'Организация', 'Создан'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.map(u => (
                  <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.role === 'ADMIN' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{u.organization?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDateTime(u.createdAt)}</td>
                  </tr>
                ))}
                {!data?.length && (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400">Нет данных</td></tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {showCreate && <CreateAdminModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
