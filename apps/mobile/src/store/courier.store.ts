import { create } from 'zustand'

interface ActiveOrder {
  id: string; number: string; status: string
  deliveryAddress: Record<string, string>
  slaDeadlineAt: string | null
  etaMinutes?: number
}

interface CourierState {
  isOnline:    boolean
  activeOrder: ActiveOrder | null
  currentShiftId: string | null
  setOnline:   (v: boolean) => void
  setActiveOrder: (o: ActiveOrder | null) => void
  setShiftId:  (id: string | null) => void
}

export const useCourierStore = create<CourierState>((set) => ({
  isOnline:       false,
  activeOrder:    null,
  currentShiftId: null,
  setOnline:      (isOnline)    => set({ isOnline }),
  setActiveOrder: (activeOrder) => set({ activeOrder }),
  setShiftId:     (currentShiftId) => set({ currentShiftId }),
}))
