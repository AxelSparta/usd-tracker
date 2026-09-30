import type { MarketPriceMap } from '@/domain/metrics'
import { getAllDolars } from '@/services/dolarApi'
import { type DolarData, DolarOption } from '@/types/dolar.types'
import { create, StateCreator } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { toast } from 'sonner'

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
      // id fijo: el refresco periódico no apila toasts si la API sigue caída
      toast.error('No se pudieron actualizar las cotizaciones.', {
        id: 'dolar-fetch-error',
      })
    }
  }
})

export const useDolarStore = create<DolarState>()(
  devtools(
    persist(dolarApi, {
      name: 'dolar-storage',
      version: 1,
      partialize: ({ allDolarData }) => ({ allDolarData }),
      // v0 → v1: misma forma; la versión solo habilita migraciones futuras
      migrate: (persistedState) => persistedState as Pick<DolarState, 'allDolarData'>,
    })
  )
)

/** Cotizaciones en la forma que espera el motor de métricas (`src/domain`) */
export const selectMarketPrices = (
  state: Pick<DolarState, 'allDolarData'>,
): MarketPriceMap<DolarOption> => {
  const prices: MarketPriceMap<DolarOption> = {}
  if (!state.allDolarData) return prices

  for (const [option, data] of Object.entries(state.allDolarData)) {
    prices[option as DolarOption] = {
      buy: Number(data.compra) || 0,
      sell: Number(data.venta) || 0,
    }
  }
  return prices
}
