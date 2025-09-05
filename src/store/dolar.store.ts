import { getDolar } from '@/services/dolarApi'
import { type DolarData, DolarOption } from '@/types/dolar.types'
import { create, StateCreator } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { dolarStorage } from './storages/dolar.storage'

interface DolarState {
  dolarData: DolarData | null
  dolarOption: DolarOption
  setDolarOption: (option: DolarOption) => void
  fetchDolarData: (option: DolarOption) => Promise<void>
}

const dolarApi: StateCreator<DolarState> = (set, get) => ({
  dolarData: null,
  dolarOption: DolarOption.Cripto,
  setDolarOption: async (option: DolarOption) => {
    await get().fetchDolarData(option)
    set({ dolarOption: option })
  },
  fetchDolarData: async (option: DolarOption) => {
    try {
      const dolarData = await getDolar(option)
      set({ dolarData })
    } catch (error) {
      console.error('Error fetching dolar data:', error)
    }
  }
})

export const useDolarStore = create<DolarState>()(
  devtools(
    persist(dolarApi, {
      name: 'dolar-storage',
      storage: dolarStorage
    })
  )
)
