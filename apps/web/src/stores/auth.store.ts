import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthUser { id: string; name: string; email: string; role: string }
interface AuthState {
  user: AuthUser | null; accessToken: string | null; refreshToken: string | null
  setAuth: (user: AuthUser, at: string, rt: string) => void
  setTokens: (at: string, rt: string) => void
  logout: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null, accessToken: null, refreshToken: null,
      setAuth: (user, accessToken, refreshToken) => set({ user, accessToken, refreshToken }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      logout: () => set({ user: null, accessToken: null, refreshToken: null }),
      isAuthenticated: () => !!get().accessToken,
    }),
    { name: 'delivery-auth' },
  ),
)
