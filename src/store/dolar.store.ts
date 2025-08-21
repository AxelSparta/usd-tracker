import { getDolar } from '@/services/dolarApi'
import { type DolarData, DolarOption } from '@/types/dolar.types'
import { create, StateCreator } from 'zustand'
import { persist } from 'zustand/middleware'

interface DolarState {
  dolarData: DolarData | null
  dolarOption: DolarOption
  setDolarOption: (option: DolarOption) => void
  fetchDolarData: () => Promise<void>
}

const dolarApi: StateCreator<DolarState> = (set, get) => ({
  dolarData: null,
  dolarOption: DolarOption.Cripto,
  setDolarOption: (option: DolarOption) => {
    set({ dolarOption: option })
    get().fetchDolarData()
  },
  fetchDolarData: async () => {
    try {
      const dolarData = await getDolar(get().dolarOption)
      set({ dolarData })
    } catch (error) {
      console.error('Error fetching dolar data:', error)
    }
  }
})

export const useDolarStore = create<DolarState>()(
  persist(dolarApi, {
    name: 'dolar-storage',
    skipHydration: true
  })
)
