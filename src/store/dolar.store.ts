import { getAllDolars } from '@/services/dolarApi'
import { type DolarData, DolarOption } from '@/types/dolar.types'
import { create, StateCreator } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface DolarState {
  allDolarData: Record<DolarOption, DolarData> | null
  fetchAllDolars: () => Promise<void>
}

const dolarApi: StateCreator<DolarState> = (set) => ({
  allDolarData: null,
  fetchAllDolars: async () => {
    try {
      const dolars = await getAllDolars()
      const dataMap = dolars.reduce((acc, dolar) => {
        const option = dolar.casa as DolarOption
        if (Object.values(DolarOption).includes(option)) {
          acc[option] = dolar
        }
        return acc
      }, {} as Record<DolarOption, DolarData>)
      
      set({ allDolarData: dataMap })
    } catch (error) {
      console.error('Error fetching dolar data:', error)
    }
  }
})

export const useDolarStore = create<DolarState>()(
  devtools(
    persist(dolarApi, {
      name: 'dolar-storage'
    })
  )
)
