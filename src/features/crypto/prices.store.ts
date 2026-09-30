import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { toast } from 'sonner'
import { CryptoApiError, fetchCoinPrices } from './api'
import type { CoinPriceMap } from './types'

interface CryptoPricesState {
  /** Último precio conocido por moneda (persistido: sirve de fallback si la API cae) */
  prices: CoinPriceMap
  /** Devuelve `false` si falló, para que el refresco periódico aplique backoff */
  fetchPrices: (ids: string[]) => Promise<boolean>
}

export const useCryptoPricesStore = create<CryptoPricesState>()(
  persist(
    (set, get) => ({
      prices: {},
      fetchPrices: async (ids) => {
        if (ids.length === 0) return true
        try {
          const fresh = await fetchCoinPrices(ids)
          set({ prices: { ...get().prices, ...fresh } })
          return true
        } catch (error) {
          console.error('Error fetching crypto prices:', error)
          const rateLimited =
            error instanceof CryptoApiError && error.status === 429
          // id fijo: el refresco periódico no apila toasts si la API sigue caída
          toast.error(
            rateLimited
              ? 'CoinGecko limitó las consultas: reintentamos en unos minutos.'
              : 'No se pudieron actualizar los precios cripto.',
            { id: 'crypto-prices-error' },
          )
          return false
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
