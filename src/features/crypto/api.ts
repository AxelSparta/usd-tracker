import type { Coin, CoinPriceMap } from './types'

// El navegador habla con nuestros route handlers, que a su vez consultan CoinGecko

const getJson = async <T>(url: string, signal?: AbortSignal): Promise<T> => {
  const response = await fetch(url, { signal })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error ?? `Error ${response.status}`)
  }
  return response.json()
}

export const fetchCoinPrices = (ids: string[]) =>
  getJson<CoinPriceMap>(
    `/api/crypto/prices?ids=${encodeURIComponent(ids.join(','))}`,
  )

export const fetchCoinSearch = (query: string, signal?: AbortSignal) =>
  getJson<Coin[]>(`/api/crypto/search?q=${encodeURIComponent(query)}`, signal)
