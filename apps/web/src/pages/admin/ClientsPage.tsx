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

interface ClientItem {
  id: string
  name: string
  email: string
  phone: string
  companyName: string | null
  inn: string | null
  contractNo: string | null
  createdAt: string
}

const emptyForm = {
  name:        '',
  email:       '',
  phone:       '+7',
  password:    '',
  companyName: '',
  inn:         '',
  contractNo:  '',
}

function CreateClientModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')

  const create = useMutation({
    mutationFn: () => api.post('/clients', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-clients'] })
      onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка создания клиента'
      setError(msg)
    },
  })

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const valid = form.name && form.email && form.phone.length >= 12 && form.password.length >= 6

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Новый B2B клиент</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Имя</Label>
              <Input className="mt-1" placeholder="Иван Иванов" value={form.name} onChange={f('name')} />
            </div>
            <div>
              <Label>Телефон</Label>
              <Input className="mt-1" placeholder="+79001234567" value={form.phone} onChange={f('phone')} />
            </div>
          </div>
          <div>
            <Label>Email</Label>
            <Input className="mt-1" type="email" placeholder="client@company.ru" value={form.email} onChange={f('email')} />
          </div>
          <div>
            <Label>Пароль (временный)</Label>
            <Input className="mt-1" type="password" placeholder="Минимум 6 символов" value={form.password} onChange={f('password')} />
          </div>
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-medium text-slate-500 uppercase mb-3">Реквизиты (необязательно)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Название компании</Label>
                <Input className="mt-1" placeholder="ООО Ромашка" value={form.companyName} onChange={f('companyName')} />
              </div>
              <div>
                <Label>ИНН</Label>
                <Input className="mt-1" placeholder="7700000000" value={form.inn} onChange={f('inn')} />
              </div>
            </div>
            <div className="mt-3">
              <Label>Номер договора</Label>
              <Input className="mt-1" placeholder="Д-2024-001" value={form.contractNo} onChange={f('contractNo')} />
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="flex gap-3 p-6 pt-0">
          <Button variant="outline" className="flex-1" onClick={onClose}>Отмена</Button>
          <Button className="flex-1" onClick={() => create.mutate()}
            disabled={!valid || create.isPending}>
            {create.isPending ? 'Создание...' : 'Создать клиента'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function ClientsPage() {
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading } = useQuery<ClientItem[]>({
    queryKey: ['admin-clients'],
    queryFn: async () => {
      const { data } = await api.get('/clients/list')
      return data.data ?? []
    },
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Клиенты</h1>
          <p className="text-sm text-slate-500">{data?.length ?? 0} всего</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={16} />Новый клиент
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  {['Клиент', 'Email', 'Телефон', 'Компания', 'ИНН', 'Договор', 'Создан'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.map(c => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                    <td className="px-4 py-3 text-slate-600">{c.email}</td>
                    <td className="px-4 py-3 text-slate-600">{c.phone}</td>
                    <td className="px-4 py-3 text-slate-600">{c.companyName ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{c.inn ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{c.contractNo ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDateTime(c.createdAt)}</td>
                  </tr>
                ))}
                {!data?.length && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">Клиенты не найдены</td></tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {showCreate && <CreateClientModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
