import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'

interface User { id: string; name: string; email: string; role: string; organizationId?: string }

interface AuthState {
  user: User | null
  isLoading: boolean
  setAuth: (user: User, accessToken: string, refreshToken: string) => Promise<void>
  logout: () => Promise<void>
  loadFromStorage: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user:      null,
  isLoading: true,

  setAuth: async (user, accessToken, refreshToken) => {
    await SecureStore.setItemAsync('accessToken',  accessToken)
    await SecureStore.setItemAsync('refreshToken', refreshToken)
    await SecureStore.setItemAsync('user',         JSON.stringify(user))
    set({ user })
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('accessToken')
    await SecureStore.deleteItemAsync('refreshToken')
    await SecureStore.deleteItemAsync('user')
    set({ user: null })
  },

  loadFromStorage: async () => {
    try {
      const raw = await SecureStore.getItemAsync('user')
      set({ user: raw ? JSON.parse(raw) : null, isLoading: false })
    } catch {
      set({ user: null, isLoading: false })
    }
  },
}))
