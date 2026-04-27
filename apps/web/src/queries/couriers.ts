import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface Courier {
  id: string; vehicleType: string; isOnline: boolean
  currentLat: number | null; currentLon: number | null; lastSeenAt: string | null
  user: { name: string }
}

export function useOnlineCouriers() {
  return useQuery({
    queryKey: ['couriers', 'online'],
    queryFn:  async () => { const { data } = await api.get('/tracking/online'); return data.data as Courier[] },
    refetchInterval: 10_000,
  })
}

export function useCouriers() {
  return useQuery({
    queryKey: ['couriers'],
    queryFn:  async () => { const { data } = await api.get('/couriers'); return data.data as Courier[] },
  })
}
