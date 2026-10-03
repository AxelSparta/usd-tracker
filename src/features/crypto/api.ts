import { requestJson } from '@/lib/http'
import type { CryptoPortfolioState, CryptoSwapInput, SwapIds } from './operations'
import type { Coin, CoinPriceMap, CryptoTransaction } from './types'

// El navegador habla con nuestros route handlers, que a su vez consultan CoinGecko

/** Error HTTP de `/api/crypto/*`: conserva el status (429 = rate limit de CoinGecko). */
export { ApiRequestError as CryptoApiError } from '@/lib/http'

const getJson = <T>(url: string, signal?: AbortSignal) => requestJson<T>(url, { signal })

export const fetchCoinPrices = (ids: string[]) =>
  getJson<CoinPriceMap>(
    `/api/crypto/prices?ids=${encodeURIComponent(ids.join(','))}`,
  )

export const fetchCoinSearch = (query: string, signal?: AbortSignal) =>
  getJson<Coin[]>(`/api/crypto/search?q=${encodeURIComponent(query)}`, signal)

// --- Operaciones del usuario en la nube (Fase 2) ---

const TRANSACTIONS = '/api/crypto/transactions'

export const cryptoApi = {
  list: () => requestJson<CryptoPortfolioState>(TRANSACTIONS),
  create: (transaction: CryptoTransaction, coin: Coin) =>
    requestJson<CryptoTransaction>(TRANSACTIONS, {
      method: 'POST',
      body: { transaction, coin },
    }),
  update: (id: string, transaction: Omit<CryptoTransaction, 'id'>, coin: Coin) =>
    requestJson<CryptoTransaction>(`${TRANSACTIONS}/${id}`, {
      method: 'PATCH',
      body: { transaction, coin },
    }),
  createSwap: (swap: CryptoSwapInput, ids: SwapIds) =>
    requestJson<CryptoTransaction[]>('/api/crypto/swaps', {
      method: 'POST',
      body: { swap, ids },
    }),
  remove: (id: string) =>
    requestJson<{ removedIds: string[] }>(`${TRANSACTIONS}/${id}`, { method: 'DELETE' }),
}
