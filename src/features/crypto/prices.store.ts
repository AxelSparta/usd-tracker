import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { toast } from 'sonner'
import { fetchCoinPrices } from './api'
import type { CoinPriceMap } from './types'

interface CryptoPricesState {
  /** Último precio conocido por moneda (persistido: sirve de fallback si la API cae) */
  prices: CoinPriceMap
  fetchPrices: (ids: string[]) => Promise<void>
}

export const useCryptoPricesStore = create<CryptoPricesState>()(
  persist(
    (set, get) => ({
      prices: {},
      fetchPrices: async (ids) => {
        if (ids.length === 0) return
        try {
          const fresh = await fetchCoinPrices(ids)
          set({ prices: { ...get().prices, ...fresh } })
        } catch (error) {
          console.error('Error fetching crypto prices:', error)
          // id fijo: el refresco periódico no apila toasts si la API sigue caída
          toast.error('No se pudieron actualizar los precios cripto.', {
            id: 'crypto-prices-error',
          })
        }
      },
    }),
    {
      name: 'crypto-prices-storage',
      version: 1,
      partialize: ({ prices }) => ({ prices }),
    },
  ),
)
