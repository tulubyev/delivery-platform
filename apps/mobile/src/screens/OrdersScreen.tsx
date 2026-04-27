import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useCourierStore } from '../store/courier.store'

interface Order { id: string; number: string; status: string; deliveryAddress: Record<string, string>; createdAt: string; slaDeadlineAt: string | null }

const STATUS_LABEL: Record<string, string> = {
  ASSIGNED: 'Назначен', PICKED_UP: 'Забран', IN_TRANSIT: 'В пути',
  DELIVERED: 'Доставлен', CANCELLED: 'Отменён', FAILED: 'Не доставлен',
}
const STATUS_COLOR: Record<string, string> = {
  ASSIGNED: '#2563eb', PICKED_UP: '#d97706', IN_TRANSIT: '#d97706',
  DELIVERED: '#16a34a', CANCELLED: '#dc2626', FAILED: '#dc2626',
}

export function OrdersScreen() {
  const qc = useQueryClient()
  const { data: courierData } = useQuery({
    queryKey: ['my-courier'],
    queryFn: async () => { const { data } = await api.get('/couriers/me'); return data.data as { id: string } },
  })

  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ['my-orders-all'],
    queryFn: async () => {
      const { data } = await api.get('/orders', { params: { courierId: courierData?.id, limit: 30 } })
      return data.data.items as Order[]
    },
    enabled: !!courierData?.id,
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/orders/${id}/status`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-orders-all'] }); qc.invalidateQueries({ queryKey: ['my-orders'] }) },
  })

  const active   = orders?.filter(o => ['ASSIGNED','PICKED_UP','IN_TRANSIT'].includes(o.status)) ?? []
  const finished = orders?.filter(o => ['DELIVERED','CANCELLED','FAILED'].includes(o.status)) ?? []

  const renderOrder = ({ item: o }: { item: Order }) => {
    const slaPassed = o.slaDeadlineAt && new Date(o.slaDeadlineAt) < new Date()
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.num}>#{o.number}</Text>
          <View style={[styles.badge, { backgroundColor: STATUS_COLOR[o.status] + '20' }]}>
            <Text style={[styles.badgeText, { color: STATUS_COLOR[o.status] }]}>{STATUS_LABEL[o.status] ?? o.status}</Text>
          </View>
        </View>
        <Text style={styles.addr}>{Object.values(o.deliveryAddress).join(', ')}</Text>
        {o.slaDeadlineAt && (
          <Text style={[styles.sla, slaPassed && styles.slaExpired]}>
            SLA: {new Date(o.slaDeadlineAt).toLocaleString('ru', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
          </Text>
        )}
        {o.status === 'ASSIGNED' && (
          <TouchableOpacity style={[styles.btn, { backgroundColor: '#2563eb' }]} onPress={() => updateStatus.mutate({ id: o.id, status: 'PICKED_UP' })}>
            <Text style={styles.btnText}>Забрать</Text>
          </TouchableOpacity>
        )}
        {o.status === 'PICKED_UP' && (
          <TouchableOpacity style={[styles.btn, { backgroundColor: '#d97706' }]} onPress={() => updateStatus.mutate({ id: o.id, status: 'IN_TRANSIT' })}>
            <Text style={styles.btnText}>В пути</Text>
          </TouchableOpacity>
        )}
        {o.status === 'IN_TRANSIT' && (
          <TouchableOpacity style={[styles.btn, { backgroundColor: '#16a34a' }]} onPress={() => updateStatus.mutate({ id: o.id, status: 'DELIVERED' })}>
            <Text style={styles.btnText}>Доставлен</Text>
          </TouchableOpacity>
        )}
      </View>
    )
  }

  return (
    <FlatList
      style={styles.container}
      data={[...active, ...finished]}
      keyExtractor={o => o.id}
      renderItem={renderOrder}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>Мои заказы</Text>
          <Text style={styles.sub}>{active.length} активных · {finished.length} завершённых</Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Заказов нет</Text>
        </View>
      }
      contentContainerStyle={{ padding: 16, gap: 10 }}
    />
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header:    { paddingBottom: 8 },
  title:     { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  sub:       { fontSize: 13, color: '#64748b', marginTop: 2 },
  card:      { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', gap: 6 },
  row:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  num:       { fontSize: 17, fontWeight: '700', color: '#2563eb', fontFamily: 'monospace' },
  badge:     { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  addr:      { fontSize: 14, color: '#334155' },
  sla:       { fontSize: 12, color: '#64748b' },
  slaExpired:{ color: '#dc2626', fontWeight: '600' },
  btn:       { borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  btnText:   { color: '#fff', fontWeight: '600', fontSize: 14 },
  empty:     { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: '#94a3b8', fontSize: 16 },
})
