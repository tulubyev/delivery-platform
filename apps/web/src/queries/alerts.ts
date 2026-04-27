import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useAlertsCount() {
  return useQuery({
    queryKey: ['alerts', 'count'],
    queryFn: async () => {
      const { data } = await api.get('/alerts/count')
      return data.data as { CRITICAL: number; HIGH: number; MEDIUM: number; LOW: number; total: number }
    },
    refetchInterval: 30_000,
  })
}

export function useAlerts(filters?: { resolved?: boolean; severity?: string }) {
  return useQuery({
    queryKey: ['alerts', filters],
    queryFn: async () => {
      const { data } = await api.get('/alerts', { params: filters })
      return data.data as { items: Alert[]; total: number }
    },
    refetchInterval: 15_000,
  })
}

export function useResolveAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.patch(`/alerts/${id}/resolve`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alerts'] }) },
  })
}

interface Alert {
  id: string; type: string; severity: string; entityType: string; entityId: string
  message: string; resolvedAt: string | null; createdAt: string
}
