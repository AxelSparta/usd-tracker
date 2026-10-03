import type { MarketPriceMap } from '@/domain/metrics'
import { DolarApiError, getAllDolars } from '@/services/dolarApi'
import { type DolarData, DolarOption } from '@/types/dolar.types'
import { create, StateCreator } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { toast } from 'sonner'

const ERROR_TOAST_ID = 'dolar-fetch-error'

interface DolarState {
  allDolarData: Record<DolarOption, DolarData> | null
  /** Devuelve `false` si falló, para que el refresco periódico aplique backoff */
  fetchAllDolars: () => Promise<boolean>
}

const dolarApi: StateCreator<DolarState> = (set, get) => ({
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
      toast.dismiss(ERROR_TOAST_ID)
      return true
    } catch (error) {
      console.error('Error fetching dolar data:', error)
      const offline =
        (error instanceof DolarApiError && error.offline) ||
        (typeof navigator !== 'undefined' && navigator.onLine === false)
      // Con cotizaciones guardadas, la app sigue usando las últimas conocidas
      const fallback = get().allDolarData ? ' Mostramos las últimas guardadas.' : ''
      // id fijo: los reintentos no apilan toasts mientras siga fallando
      toast.error(
        offline
          ? `Sin conexión: no se pudieron actualizar las cotizaciones.${fallback}`
          : `DolarAPI no responde: reintentamos en unos segundos.${fallback}`,
        { id: ERROR_TOAST_ID },
      )
      return false
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
