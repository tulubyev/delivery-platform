import { useEffect, useRef } from 'react'
import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import { Platform } from 'react-native'
import { api } from '../lib/api'

export const LOCATION_TASK = 'background-location-task'

// TaskManager задача — выполняется даже когда приложение в фоне (iOS / Android)
// На iOS WS закрывается через ~3 мин фона — используем HTTP POST
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }: { data?: { locations?: Location.LocationObject[] }; error?: TaskManager.TaskManagerError | null }) => {
  if (error || !data?.locations?.length) return
  const loc = data.locations[0]
  try {
    await api.post('/tracking/location', {
      lat:       loc.coords.latitude,
      lon:       loc.coords.longitude,
      speed:     loc.coords.speed ?? 0,
      heading:   loc.coords.heading ?? 0,
      accuracy:  loc.coords.accuracy ?? 0,
      timestamp: loc.timestamp,
    })
  } catch { /* silent — повторит при следующем обновлении */ }
})

export function useLocationTracking(courierId: string | null, isOnline: boolean) {
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!isOnline || !courierId) {
      stopTracking()
      return
    }
    startTracking(courierId)
    return () => stopTracking()
  }, [isOnline, courierId])

  async function startTracking(courierId: string) {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') return

    // Background permission (iOS требует отдельно)
    await Location.requestBackgroundPermissionsAsync()

    // WS — для foreground (быстрые обновления)
    connectWs(courierId)

    // Background task — HTTP POST каждые 30 сек (iOS background)
    const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK)
    if (!isRegistered) {
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        accuracy:              Location.Accuracy.High,
        timeInterval:          30_000,
        distanceInterval:      50,   // минимум 50м между обновлениями
        foregroundService: {         // Android foreground service
          notificationTitle: 'Delivery — трекинг активен',
          notificationBody:  'Геолокация передаётся диспетчеру',
        },
        pausesUpdatesAutomatically: false,
        activityType:          Location.ActivityType.AutomotiveNavigation,
      })
    }
  }

  async function connectWs(courierId: string) {
    const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? 'wss://api.lastmiles.ru/ws'
    const SecureStore = await import('expo-secure-store')
    const token = (await SecureStore.getItemAsync('accessToken')) ?? ''

    wsRef.current = new WebSocket(`${WS_URL}?token=${token}`)

    wsRef.current.onopen = () => {
      // Начинаем слать позицию через WS каждые 5 сек в foreground
      const interval = setInterval(async () => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) { clearInterval(interval); return }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
        wsRef.current.send(JSON.stringify({
          type: 'LOCATION_UPDATE',
          payload: {
            courierId,
            lat:       loc.coords.latitude,
            lon:       loc.coords.longitude,
            speed:     loc.coords.speed ?? 0,
            heading:   loc.coords.heading ?? 0,
            accuracy:  loc.coords.accuracy ?? 0,
            timestamp: loc.timestamp,
          },
        }))
      }, 5_000)

      wsRef.current!.onclose = () => clearInterval(interval)
    }

    wsRef.current.onerror = () => {
      // WS недоступен — background task через HTTP продолжит работу
    }
  }

  async function stopTracking() {
    wsRef.current?.close()
    wsRef.current = null
    const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK)
    if (isRegistered) await Location.stopLocationUpdatesAsync(LOCATION_TASK)
  }
}
