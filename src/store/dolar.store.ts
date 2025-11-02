import { getDolar } from '@/services/dolarApi'
import { type DolarData, DolarOption } from '@/types/dolar.types'
import { create, StateCreator } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface DolarState {
  dolarData: DolarData | null
  dolarOption: DolarOption | ''
  setDolarOption: (option: DolarOption) => void
}

const dolarApi: StateCreator<DolarState> = (set, get) => ({
  dolarData: null,
  dolarOption: '',
  setDolarOption: async (option: DolarOption | '') => {
    set({ dolarData: null })
    try {
      if (option === '') {
        set({ dolarOption: option })
        return
      }
      const dolarData = await getDolar(option)
      set({ dolarData })
    } catch (error) {
      console.error('Error fetching dolar data:', error)
    }
    set({ dolarOption: option })
  }
})

export const useDolarStore = create<DolarState>()(
  devtools(
    persist(dolarApi, {
      name: 'dolar-storage'
    })
  )
)
