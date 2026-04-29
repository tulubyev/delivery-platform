import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime } from '@/lib/utils'

const ROLES = ['ADMIN','ORG_ADMIN','SUPERVISOR','COURIER','CLIENT']
const ROLE_COLOR: Record<string, string> = {
  ADMIN:     'bg-red-100 text-red-700',
  ORG_ADMIN: 'bg-purple-100 text-purple-700',
  SUPERVISOR:'bg-blue-100 text-blue-700',
  COURIER:   'bg-green-100 text-green-700',
  CLIENT:    'bg-slate-100 text-slate-700',
}

interface UserRow {
  id: string; name: string; email: string; phone: string; role: string
  phoneVerified: boolean; createdAt: string
  organization: { name: string } | null
}

export function SuperAdminAllUsersPage() {
  const [role, setRole]   = useState<string | undefined>()
  const [search, setSearch] = useState('')
  const [page, setPage]   = useState(1)

  const { data, isLoading } = useQuery<{ items: UserRow[]; total: number }>({
    queryKey: ['superadmin-users', role, search, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '30' })
      if (role)   params.set('role', role)
      if (search) params.set('search', search)
      const { data } = await api.get(`/superadmin/users?${params}`)
      return data.data
    },
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Все пользователи</h1>
          <p className="text-sm text-slate-500">{data?.total ?? 0} всего</p>
        </div>
        <input
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Поиск по имени / email..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => { setRole(undefined); setPage(1) }}
          className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${!role ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
          Все
        </button>
        {ROLES.map(r => (
          <button key={r} onClick={() => { setRole(r); setPage(1) }}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${role === r ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
            {r}
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
                    {['Имя', 'Email', 'Телефон', 'Роль', 'Организация', 'Верифицирован', 'Создан'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map(u => (
                    <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                      <td className="px-4 py-3 text-slate-600">{u.email}</td>
                      <td className="px-4 py-3 text-slate-500">{u.phone}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLOR[u.role] ?? 'bg-slate-100 text-slate-600'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{u.organization?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={u.phoneVerified ? 'text-green-600' : 'text-amber-500'}>
                          {u.phoneVerified ? '✓ Да' : '✗ Нет'}
                        </span>
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
    </div>
  )
}
