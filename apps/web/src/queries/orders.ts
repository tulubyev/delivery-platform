import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface Order {
  id: string; number: string; status: string; dispatchMode: string
  courierId: string | null; slaDeadlineAt: string | null
  createdAt: string; deliveryAddress: Record<string, string>
}

export function useOrders(filters?: Record<string, string | number | undefined>) {
  return useQuery({
    queryKey: ['orders', filters],
    queryFn: async () => {
      const { data } = await api.get('/orders', { params: filters })
      return data.data as { items: Order[]; total: number; page: number; limit: number }
    },
  })
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['orders', id],
    queryFn:  async () => { const { data } = await api.get(`/orders/${id}`); return data.data as Order },
    enabled: !!id,
  })
}

export function useCreateOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/orders', body),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['orders'] }),
  })
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/orders/${id}/status`, { status }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['orders'] }),
  })
}
