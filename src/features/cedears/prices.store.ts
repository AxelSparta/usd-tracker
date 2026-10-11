import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { toast } from 'sonner'
import { fetchCedearPrices } from './api'
import type { CedearPriceMap } from './types'

interface CedearPricesState {
  /** Último precio conocido por ticker (persistido: sirve de fallback si data912 cae) */
  prices: CedearPriceMap
  /** Devuelve `false` si falló, para que el refresco periódico aplique backoff */
  fetchPrices: (tickers: string[]) => Promise<boolean>
}

export const useCedearPricesStore = create<CedearPricesState>()(
  persist(
    (set, get) => ({
      prices: {},
      fetchPrices: async (tickers) => {
        if (tickers.length === 0) return true
        try {
          const fresh = await fetchCedearPrices(tickers)
          set({ prices: { ...get().prices, ...fresh } })
          return true
        } catch (error) {
          console.error('Error fetching CEDEAR prices:', error)
          // id fijo: el refresco periódico no apila toasts si data912 sigue caído
          toast.error('No se pudieron actualizar los precios de los CEDEARs.', {
            id: 'cedear-prices-error',
          })
          return false
        }
      },
    }),
    {
      name: 'cedears-prices-storage',
      version: 1,
      partialize: ({ prices }) => ({ prices }),
    },
  ),
)
