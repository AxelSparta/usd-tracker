import { format, isToday } from 'date-fns'
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

/**
 * Precio USD de una moneda en un día: el actual si es hoy; si no, el del histórico (ese día o el
 * último anterior). `null` si la fecha es anterior al histórico (último año).
 */
export const fetchCoinPriceOn = async (coinId: string, day: Date): Promise<number | null> => {
  if (isToday(day)) return (await fetchCoinPrices([coinId]))[coinId]?.usd ?? null
  const history = await getJson<Record<string, { date: string; usd: number }[]>>(
    `/api/history/crypto?ids=${encodeURIComponent(coinId)}`,
  )
  const key = format(day, 'yyyy-MM-dd')
  let price: number | null = null
  for (const point of history[coinId] ?? []) {
    if (point.date > key) break
    price = point.usd
  }
  return price
}

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
