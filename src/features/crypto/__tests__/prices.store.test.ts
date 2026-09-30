import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCryptoPricesStore } from '@/features/crypto/prices.store'

const btcPrice = { usd: 60_000, change24h: 1.5, updatedAt: 1_700_000_000_000 }

const mockFetch = (status: number, body: unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json(body, { status })),
  )

describe('useCryptoPricesStore.fetchPrices', () => {
  beforeEach(() => {
    useCryptoPricesStore.setState({ prices: {} })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('guarda los precios y devuelve true', async () => {
    mockFetch(200, { bitcoin: btcPrice })
    await expect(useCryptoPricesStore.getState().fetchPrices(['bitcoin'])).resolves.toBe(true)
    expect(useCryptoPricesStore.getState().prices.bitcoin).toEqual(btcPrice)
  })

  it('ante un 429 devuelve false y conserva el último precio conocido', async () => {
    useCryptoPricesStore.setState({ prices: { bitcoin: btcPrice } })
    mockFetch(429, { error: 'Demasiadas consultas a CoinGecko, probá en un minuto.' })
    await expect(useCryptoPricesStore.getState().fetchPrices(['bitcoin'])).resolves.toBe(false)
    expect(useCryptoPricesStore.getState().prices.bitcoin).toEqual(btcPrice)
  })
})
