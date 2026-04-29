import { useEffect, useState } from 'react'
import { View, Text } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import NetInfo from '@react-native-community/netinfo'
import { AppNavigator } from './src/navigation/AppNavigator'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime:   5 * 60_000,       // данные свежие 5 мин
      gcTime:     24 * 60 * 60_000,  // кеш живёт 24ч
      networkMode: 'offlineFirst',   // отдавать кеш при отсутствии сети
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
})

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'LASTMILES_QUERY_CACHE',
  throttleTime: 3000,
})

function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      setIsOffline(state.isConnected === false)
    })
    return unsub
  }, [])

  if (!isOffline) return null

  return (
    <View style={{
      backgroundColor: '#dc2626',
      paddingVertical: 6,
      alignItems: 'center',
      position: 'absolute',
      top: 0, left: 0, right: 0,
      zIndex: 9999,
    }}>
      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
        ⚠️ Нет сети — работа из кеша
      </Text>
    </View>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister, maxAge: 24 * 60 * 60_000 }}
      >
        <StatusBar style="dark" />
        <OfflineBanner />
        <AppNavigator />
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  )
}
