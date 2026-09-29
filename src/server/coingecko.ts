import { z } from 'zod'
import type { Coin, CoinPriceMap } from '@/features/crypto/types'

/**
 * Cliente de CoinGecko. Solo se usa desde route handlers (`src/app/api/crypto/*`):
 * así la API key opcional no llega al navegador y el Data Cache de Next comparte
 * las respuestas entre usuarios, cuidando el rate limit del plan gratuito.
 */

const BASE_URL = 'https://api.coingecko.com/api/v3'

export class CoinGeckoError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

const coinGeckoFetch = async (
  path: string,
  params: Record<string, string>,
  revalidate: number,
): Promise<unknown> => {
  const url = `${BASE_URL}${path}?${new URLSearchParams(params)}`
  const apiKey = process.env.COINGECKO_API_KEY
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      ...(apiKey ? { 'x-cg-demo-api-key': apiKey } : {}),
    },
    next: { revalidate },
  })
  if (!response.ok) {
    throw new CoinGeckoError(
      `CoinGecko respondió ${response.status}`,
      response.status,
    )
  }
  return response.json()
}

const simplePriceSchema = z.record(
  z.string(),
  z.object({
    usd: z.number(),
    usd_24h_change: z.number().nullish(),
    last_updated_at: z.number().nullish(),
  }),
)

/** Precio USD, variación 24 h y última actualización. Los ids desconocidos se omiten. */
export const getPrices = async (ids: string[]): Promise<CoinPriceMap> => {
  const data = simplePriceSchema.parse(
    await coinGeckoFetch(
      '/simple/price',
      {
        ids: ids.join(','),
        vs_currencies: 'usd',
        include_24hr_change: 'true',
        include_last_updated_at: 'true',
      },
      60,
    ),
  )

  const prices: CoinPriceMap = {}
  for (const [id, entry] of Object.entries(data)) {
    prices[id] = {
      usd: entry.usd,
      change24h: entry.usd_24h_change ?? null,
      updatedAt: entry.last_updated_at ? entry.last_updated_at * 1000 : null,
    }
  }
  return prices
}

const searchSchema = z.object({
  coins: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      symbol: z.string(),
      thumb: z.string().nullish(),
    }),
  ),
})

export const searchCoins = async (query: string, limit = 10): Promise<Coin[]> => {
  const data = searchSchema.parse(
    await coinGeckoFetch('/search', { query }, 60 * 60),
  )
  return data.coins.slice(0, limit).map((coin) => ({
    id: coin.id,
    name: coin.name,
    symbol: coin.symbol.toUpperCase(),
    image: coin.thumb || null,
  }))
}

const marketsSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    symbol: z.string(),
    image: z.string().nullish(),
  }),
)

/** Las monedas con mayor capitalización (sugerencias del buscador vacío). */
export const getTopCoins = async (limit = 10): Promise<Coin[]> => {
  const data = marketsSchema.parse(
    await coinGeckoFetch(
      '/coins/markets',
      {
        vs_currency: 'usd',
        order: 'market_cap_desc',
        per_page: String(limit),
        page: '1',
      },
      60 * 60,
    ),
  )
  return data.map((coin) => ({
    id: coin.id,
    name: coin.name,
    symbol: coin.symbol.toUpperCase(),
    image: coin.image || null,
  }))
}

/** Traduce errores de CoinGecko a una respuesta JSON para los route handlers. */
export const coinGeckoErrorResponse = (error: unknown): Response => {
  console.error('CoinGecko:', error)
  if (error instanceof CoinGeckoError && error.status === 429) {
    return Response.json(
      { error: 'Demasiadas consultas a CoinGecko, probá en un minuto.' },
      { status: 429 },
    )
  }
  return Response.json(
    { error: 'No se pudo consultar CoinGecko.' },
    { status: 502 },
  )
}
