import { useEffect } from 'react'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { api } from '../lib/api'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
})

export function usePushNotifications(courierId: string | null) {
  useEffect(() => {
    if (!courierId) return
    registerForPush(courierId)
  }, [courierId])
}

async function registerForPush(courierId: string) {
  const { status } = await Notifications.requestPermissionsAsync()
  if (status !== 'granted') return

  const token = await Notifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
  })

  // Сохраняем токен в БД — сервер будет слать push через Expo
  try {
    await api.patch(`/couriers/${courierId}/push-token`, { expoPushToken: token.data })
  } catch { /* silent */ }

  // Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name:             'Уведомления',
      importance:        Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor:       '#2563eb',
    })
  }
}
