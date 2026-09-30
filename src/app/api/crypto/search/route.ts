import type { NextRequest } from 'next/server'
import {
  coinGeckoErrorResponse,
  getTopCoins,
  searchCoins,
} from '@/server/coingecko'

/** GET /api/crypto/search?q=sol → `Coin[]`; sin `q`, las de mayor capitalización */
export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 50)

  try {
    return Response.json(
      query ? await searchCoins(query.toLowerCase()) : await getTopCoins(),
    )
  } catch (error) {
    return coinGeckoErrorResponse(error)
  }
}
