import { useEffect, useRef, useState } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text, View } from 'react-native'
import * as Notifications from 'expo-notifications'
import { useAuthStore } from '../store/auth.store'
import { LoginScreen }   from '../screens/LoginScreen'
import { HomeScreen }    from '../screens/HomeScreen'
import { OrdersScreen }  from '../screens/OrdersScreen'
import { ProfileScreen } from '../screens/ProfileScreen'
import { OfferScreen }   from '../screens/OfferScreen'

interface PendingOffer { offerId: string; orderNum: string; address: string; distKm?: number; timeoutSec: number }

const Stack = createNativeStackNavigator()
const Tab   = createBottomTabNavigator()

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = { Home: '🏠', Orders: '📦', Profile: '👤' }
  return <Text style={{ fontSize: focused ? 22 : 18, opacity: focused ? 1 : 0.5 }}>{icons[name]}</Text>
}

function CourierTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor:   '#2563eb',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: { borderTopColor: '#e2e8f0', paddingBottom: 4, height: 60 },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home"    component={HomeScreen}    options={{ tabBarLabel: 'Главная' }} />
      <Tab.Screen name="Orders"  component={OrdersScreen}  options={{ tabBarLabel: 'Заказы' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: 'Профиль' }} />
    </Tab.Navigator>
  )
}

export function AppNavigator() {
  const { user, loadFromStorage } = useAuthStore()
  const [offer, setOffer] = useState<PendingOffer | null>(null)
  const notifListener = useRef<Notifications.EventSubscription | null>(null)

  useEffect(() => { loadFromStorage() }, [])

  useEffect(() => {
    notifListener.current = Notifications.addNotificationReceivedListener(notification => {
      const d = notification.request.content.data as Record<string, unknown>
      if (d?.type === 'ORDER_OFFER') {
        setOffer({
          offerId:    d.offerId as string,
          orderNum:   d.orderNum as string,
          address:    d.address as string,
          distKm:     d.distKm as number | undefined,
          timeoutSec: (d.timeoutSec as number) ?? 30,
        })
      }
    })
    return () => notifListener.current?.remove()
  }, [])

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {user ? (
            <Stack.Screen name="Main" component={CourierTabs} />
          ) : (
            <Stack.Screen name="Login" component={LoginScreen} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
      {offer && (
        <OfferScreen
          {...offer}
          onDismiss={() => setOffer(null)}
        />
      )}
    </View>
  )
}
