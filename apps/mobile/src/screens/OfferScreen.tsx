import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated, Vibration } from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

interface Props {
  offerId:   string
  orderNum:  string
  address:   string
  distKm?:   number
  timeoutSec: number
  onDismiss: () => void
}

export function OfferScreen({ offerId, orderNum, address, distKm, timeoutSec, onDismiss }: Props) {
  const qc = useQueryClient()
  const [timeLeft, setTimeLeft] = useState(timeoutSec)
  const progress = new Animated.Value(1)

  useEffect(() => {
    Vibration.vibrate([0, 400, 200, 400])

    // Таймер
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(interval); onDismiss(); return 0 }
        return t - 1
      })
    }, 1000)

    // Прогресс-бар анимация
    Animated.timing(progress, {
      toValue: 0, duration: timeoutSec * 1000, useNativeDriver: false,
    }).start()

    return () => clearInterval(interval)
  }, [])

  const accept = useMutation({
    mutationFn: () => api.post(`/dispatch/offers/${offerId}/accept`),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['my-orders'] }); onDismiss() },
  })

  const decline = useMutation({
    mutationFn: () => api.post(`/dispatch/offers/${offerId}/decline`),
    onSuccess:  onDismiss,
  })

  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })

  return (
    <View style={styles.overlay}>
      <View style={styles.modal}>
        {/* Progress bar */}
        <View style={styles.progressBg}>
          <Animated.View style={[styles.progressBar, { width: barWidth }]} />
        </View>

        <Text style={styles.timer}>{timeLeft}с</Text>
        <Text style={styles.title}>Новый заказ</Text>
        <Text style={styles.num}>#{orderNum}</Text>
        <Text style={styles.addr}>{address}</Text>
        {distKm !== undefined && <Text style={styles.dist}>📍 {distKm.toFixed(1)} км от вас</Text>}

        <View style={styles.btns}>
          <TouchableOpacity style={[styles.btn, styles.declineBtn]} onPress={() => decline.mutate()} disabled={decline.isPending}>
            <Text style={styles.declineTxt}>Отклонить</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.acceptBtn]} onPress={() => accept.mutate()} disabled={accept.isPending}>
            <Text style={styles.acceptTxt}>Принять</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay:     { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end', zIndex: 100 },
  modal:       { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 10 },
  progressBg:  { height: 4, backgroundColor: '#e2e8f0', borderRadius: 2 },
  progressBar: { height: 4, backgroundColor: '#2563eb', borderRadius: 2 },
  timer:       { fontSize: 13, color: '#64748b', textAlign: 'right' },
  title:       { fontSize: 14, fontWeight: '500', color: '#64748b' },
  num:         { fontSize: 26, fontWeight: '800', color: '#2563eb', fontFamily: 'monospace' },
  addr:        { fontSize: 16, color: '#0f172a', lineHeight: 22 },
  dist:        { fontSize: 14, color: '#2563eb', fontWeight: '500' },
  btns:        { flexDirection: 'row', gap: 12, marginTop: 8 },
  btn:         { flex: 1, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  declineBtn:  { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' },
  acceptBtn:   { backgroundColor: '#2563eb' },
  declineTxt:  { color: '#dc2626', fontWeight: '700', fontSize: 16 },
  acceptTxt:   { color: '#fff',    fontWeight: '700', fontSize: 16 },
})
