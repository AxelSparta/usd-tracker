import type { NextRequest } from 'next/server'
import { coinGeckoErrorResponse, getPrices } from '@/server/coingecko'

// ids de CoinGecko: minúsculas, dígitos y guiones (ej. `bitcoin`, `usd-coin`)
const COIN_ID = /^[a-z0-9-]{1,100}$/
const MAX_IDS = 50

/** GET /api/crypto/prices?ids=bitcoin,ethereum → `CoinPriceMap` */
export async function GET(request: NextRequest) {
  const ids = [
    ...new Set(
      (request.nextUrl.searchParams.get('ids') ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ].sort() // orden estable: misma URL a CoinGecko → mejor aprovechamiento del cache

  if (ids.length === 0) return Response.json({})
  if (ids.length > MAX_IDS || !ids.every((id) => COIN_ID.test(id))) {
    return Response.json({ error: 'Parámetro ids inválido.' }, { status: 400 })
  }

  try {
    return Response.json(await getPrices(ids))
  } catch (error) {
    return coinGeckoErrorResponse(error)
  }
}
