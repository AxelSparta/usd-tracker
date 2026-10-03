import type { NextRequest } from 'next/server'
import {
  CoinGeckoError,
  coinGeckoErrorResponse,
  getCoinHistory,
  type CoinHistoryPoint,
} from '@/server/coingecko'

// ids de CoinGecko: minúsculas, dígitos y guiones (ej. `bitcoin`, `usd-coin`)
const COIN_ID = /^[a-z0-9-]{1,100}$/
const MAX_IDS = 20

/**
 * GET /api/history/crypto?ids=bitcoin,ethereum → `{ [id]: CoinHistoryPoint[] }`
 * Precio USD diario del último año. Una moneda que CoinGecko no conoce se omite.
 */
export async function GET(request: NextRequest) {
  const ids = [
    ...new Set(
      (request.nextUrl.searchParams.get('ids') ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ]
  if (ids.length === 0) return Response.json({})
  if (ids.length > MAX_IDS || !ids.every((id) => COIN_ID.test(id))) {
    return Response.json({ error: 'Parámetro ids inválido.' }, { status: 400 })
  }

  try {
    // En serie: cuida el rate limit del plan público (cada moneda es una consulta)
    const history: Record<string, CoinHistoryPoint[]> = {}
    for (const id of ids) {
      try {
        history[id] = await getCoinHistory(id)
      } catch (error) {
        if (error instanceof CoinGeckoError && error.status === 404) continue
        throw error
      }
    }
    return Response.json(history)
  } catch (error) {
    return coinGeckoErrorResponse(error)
  }
}
