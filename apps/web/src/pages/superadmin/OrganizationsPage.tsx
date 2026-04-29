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

interface Org { id: string; name: string; slug: string; inn: string | null; createdAt: string; _count?: { users: number } }

function CreateOrgModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: '', slug: '', inn: '' })
  const [error, setError] = useState('')

  const create = useMutation({
    mutationFn: () => api.post('/organizations', { name: form.name, slug: form.slug, inn: form.inn || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['superadmin-orgs'] }); onClose() },
    onError: (e: unknown) => {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка создания')
    },
  })

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const autoSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Новая организация</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <Label>Название</Label>
            <Input className="mt-1" placeholder="ООО Доставка" value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value, slug: autoSlug(e.target.value) }))} />
          </div>
          <div>
            <Label>Slug (латиница, цифры, дефис)</Label>
            <Input className="mt-1" placeholder="dostavka" value={form.slug} onChange={f('slug')} />
          </div>
          <div>
            <Label>ИНН (необязательно)</Label>
            <Input className="mt-1" placeholder="7700000000" value={form.inn} onChange={f('inn')} />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="flex gap-3 p-6 pt-0">
          <Button variant="outline" className="flex-1" onClick={onClose}>Отмена</Button>
          <Button className="flex-1" disabled={!form.name || !form.slug || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? 'Создание...' : 'Создать'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function SuperAdminOrgsPage() {
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading } = useQuery<{ items: Org[]; total: number }>({
    queryKey: ['superadmin-orgs'],
    queryFn: async () => {
      const { data } = await api.get('/organizations')
      return data.data ?? { items: [], total: 0 }
    },
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Организации</h1>
          <p className="text-sm text-slate-500">{data?.total ?? 0} всего</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={16} />Новая организация
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
                  {['Название', 'Slug', 'ИНН', 'Создана'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.items?.map(o => (
                  <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{o.name}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{o.slug}</td>
                    <td className="px-4 py-3 text-slate-500">{o.inn ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDateTime(o.createdAt)}</td>
                  </tr>
                ))}
                {!data?.items?.length && (
                  <tr><td colSpan={4} className="px-4 py-12 text-center text-slate-400">Организации не найдены</td></tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {showCreate && <CreateOrgModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
