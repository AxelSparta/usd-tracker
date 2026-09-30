import type { Coin, CoinPriceMap } from './types'

// El navegador habla con nuestros route handlers, que a su vez consultan CoinGecko

/** Error HTTP de `/api/crypto/*`: conserva el status (429 = rate limit de CoinGecko). */
export class CryptoApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

const getJson = async <T>(url: string, signal?: AbortSignal): Promise<T> => {
  const response = await fetch(url, { signal })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new CryptoApiError(
      body?.error ?? `Error ${response.status}`,
      response.status,
    )
  }
  return response.json()
}

export const fetchCoinPrices = (ids: string[]) =>
  getJson<CoinPriceMap>(
    `/api/crypto/prices?ids=${encodeURIComponent(ids.join(','))}`,
  )

export const fetchCoinSearch = (query: string, signal?: AbortSignal) =>
  getJson<Coin[]>(`/api/crypto/search?q=${encodeURIComponent(query)}`, signal)
