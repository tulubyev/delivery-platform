import { useState, useEffect } from 'react'
import { View, Text, Switch, TouchableOpacity, StyleSheet, ScrollView, Alert, StatusBar } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/auth.store'
import { useCourierStore } from '../store/courier.store'
import { useLocationTracking } from '../hooks/useLocation'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { api } from '../lib/api'

interface Shift { id: string; status: string; scheduledStart: string; scheduledEnd: string; zone?: { name: string } }
interface Order  { id: string; number: string; status: string; deliveryAddress: Record<string, string>; slaDeadlineAt: string | null }

export function HomeScreen() {
  const { user, logout } = useAuthStore()
  const insets = useSafeAreaInsets()
  const { isOnline, setOnline, activeOrder, setActiveOrder, currentShiftId, setShiftId } = useCourierStore()
  const qc = useQueryClient()

  // Запрос courierId
  const { data: courierData } = useQuery({
    queryKey: ['my-courier'],
    queryFn: async () => { const { data } = await api.get('/couriers/me'); return data.data as { id: string } },
  })
  const courierId = courierData?.id ?? null

  // GPS трекинг + push
  useLocationTracking(courierId, isOnline)
  usePushNotifications(courierId)

  // Сегодняшние смены
  const { data: shifts } = useQuery({
    queryKey: ['my-shifts'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0]
      const { data } = await api.get('/shifts', { params: { courierId, date: today, status: 'SCHEDULED' } })
      return data.data as Shift[]
    },
    enabled: !!courierId,
  })

  // Активный заказ
  const { data: orders } = useQuery({
    queryKey: ['my-orders'],
    queryFn: async () => {
      const { data } = await api.get('/orders', { params: { courierId, limit: 5 } })
      return data.data.items as Order[]
    },
    enabled: !!courierId,
    refetchInterval: 15_000,
  })

  useEffect(() => {
    const active = orders?.find(o => ['ASSIGNED','PICKED_UP','IN_TRANSIT'].includes(o.status))
    setActiveOrder(active ?? null)
  }, [orders])

  // Начать смену
  const startShift = useMutation({
    mutationFn: (shiftId: string) => api.post(`/shifts/${shiftId}/start`),
    onSuccess: (_, shiftId) => { setShiftId(shiftId); setOnline(true); qc.invalidateQueries({ queryKey: ['my-shifts'] }) },
  })

  // Завершить смену
  const endShift = useMutation({
    mutationFn: () => api.post(`/shifts/${currentShiftId}/end`),
    onSuccess: () => { setShiftId(null); setOnline(false); qc.invalidateQueries({ queryKey: ['my-shifts'] }) },
    onError: (e: unknown) => Alert.alert('Ошибка', (e as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Не удалось завершить смену'),
  })

  // Обновить статус заказа
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/orders/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-orders'] }),
  })

  const activeShift = shifts?.find(s => s.status === 'SCHEDULED')

  const STATUS_NEXT: Record<string, { label: string; next: string }> = {
    ASSIGNED:   { label: 'Забрать заказ',    next: 'PICKED_UP'  },
    PICKED_UP:  { label: 'В пути',           next: 'IN_TRANSIT' },
    IN_TRANSIT: { label: 'Доставлен',        next: 'DELIVERED'  },
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Привет, {user?.name?.split(' ')[0]} 👋</Text>
          <Text style={styles.role}>Курьер</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Выйти</Text>
        </TouchableOpacity>
      </View>

      {/* Online toggle */}
      <View style={[styles.card, { paddingRight: 56 }]}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{isOnline ? '🟢 Онлайн' : '⚪ Офлайн'}</Text>
            <Text style={styles.cardSub}>{isOnline ? 'Геолокация передаётся' : 'Начните смену чтобы получать заказы'}</Text>
          </View>
          <Switch
            value={isOnline}
            onValueChange={(v) => {
              if (!v && currentShiftId) endShift.mutate()
              else if (v && activeShift) startShift.mutate(activeShift.id)
              else setOnline(v)
            }}
            trackColor={{ false: '#e2e8f0', true: '#86efac' }}
            thumbColor={isOnline ? '#16a34a' : '#94a3b8'}
          />
        </View>
      </View>

      {/* Active order */}
      {activeOrder ? (
        <View style={[styles.card, styles.activeOrderCard]}>
          <Text style={styles.cardTitle}>📦 Активный заказ</Text>
          <Text style={styles.orderNum}>#{activeOrder.number}</Text>
          <Text style={styles.orderAddr}>{Object.values(activeOrder.deliveryAddress).join(', ')}</Text>
          {activeOrder.slaDeadlineAt && (
            <Text style={[styles.slaText, new Date(activeOrder.slaDeadlineAt) < new Date() && styles.slaExpired]}>
              SLA: {new Date(activeOrder.slaDeadlineAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
          {STATUS_NEXT[activeOrder.status] && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => updateStatus.mutate({ id: activeOrder.id, status: STATUS_NEXT[activeOrder.status].next })}
            >
              <Text style={styles.actionBtnText}>{STATUS_NEXT[activeOrder.status].label}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.emptyText}>Нет активных заказов</Text>
          <Text style={styles.cardSub}>{isOnline ? 'Ждём назначения...' : 'Включите режим онлайн'}</Text>
        </View>
      )}

      {/* Today's shift */}
      {activeShift && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📅 Смена сегодня</Text>
          <Text style={styles.cardSub}>
            {new Date(activeShift.scheduledStart).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })} — {new Date(activeShift.scheduledEnd).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {activeShift.zone && <Text style={styles.zone}>📍 {activeShift.zone.name}</Text>}
          {!isOnline && (
            <TouchableOpacity style={styles.startBtn} onPress={() => startShift.mutate(activeShift.id)}>
              <Text style={styles.startBtnText}>Начать смену</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#f8fafc' },
  content:        { padding: 16, gap: 12 },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  greeting:       { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  role:           { fontSize: 13, color: '#64748b' },
  logoutBtn:      { padding: 8 },
  logoutText:     { color: '#ef4444', fontSize: 14 },
  card:           { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', gap: 6 },
  activeOrderCard:{ borderColor: '#2563eb', borderWidth: 2 },
  row:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle:      { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  cardSub:        { fontSize: 13, color: '#64748b' },
  orderNum:       { fontSize: 20, fontWeight: '700', color: '#2563eb', fontFamily: 'monospace' },
  orderAddr:      { fontSize: 14, color: '#334155' },
  slaText:        { fontSize: 13, color: '#64748b' },
  slaExpired:     { color: '#dc2626', fontWeight: '600' },
  actionBtn:      { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  actionBtnText:  { color: '#fff', fontWeight: '600', fontSize: 15 },
  emptyText:      { fontSize: 16, fontWeight: '600', color: '#94a3b8', textAlign: 'center', paddingVertical: 8 },
  startBtn:       { backgroundColor: '#16a34a', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  startBtnText:   { color: '#fff', fontWeight: '600', fontSize: 15 },
  zone:           { fontSize: 13, color: '#2563eb' },
})
