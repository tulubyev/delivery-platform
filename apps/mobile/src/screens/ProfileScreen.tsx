import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../store/auth.store'
import { api } from '../lib/api'

interface CourierProfile { id: string; isOnline: boolean; rating: number | null; totalDeliveries: number }

export function ProfileScreen() {
  const { user, logout } = useAuthStore()

  const { data: courier } = useQuery<CourierProfile>({
    queryKey: ['my-courier'],
    queryFn: async () => { const { data } = await api.get('/couriers/me'); return data.data },
  })

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase() ?? '?'}</Text>
      </View>
      <Text style={styles.name}>{user?.name}</Text>
      <Text style={styles.email}>{user?.email}</Text>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{courier?.totalDeliveries ?? 0}</Text>
          <Text style={styles.statLabel}>Доставок</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{courier?.rating != null ? courier.rating.toFixed(1) : '—'}</Text>
          <Text style={styles.statLabel}>Рейтинг</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: courier?.isOnline ? '#16a34a' : '#94a3b8' }]}>
            {courier?.isOnline ? 'Онлайн' : 'Офлайн'}
          </Text>
          <Text style={styles.statLabel}>Статус</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Выйти из аккаунта</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f8fafc' },
  content:     { padding: 24, alignItems: 'center', gap: 12 },
  avatarCircle:{ width: 88, height: 88, borderRadius: 44, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  avatarText:  { fontSize: 36, fontWeight: '700', color: '#fff' },
  name:        { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  email:       { fontSize: 14, color: '#64748b' },
  statsRow:    { flexDirection: 'row', gap: 12, marginTop: 16, width: '100%' },
  statBox:     { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', gap: 4 },
  statValue:   { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  statLabel:   { fontSize: 12, color: '#64748b' },
  logoutBtn:   { marginTop: 24, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32 },
  logoutText:  { color: '#dc2626', fontWeight: '600', fontSize: 16 },
})
