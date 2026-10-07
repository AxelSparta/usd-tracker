import type { NextRequest } from 'next/server'
import { CEDEAR_TICKER } from '@/features/cedears/catalog'
import type { CedearPriceMap } from '@/features/cedears/types'
import { data912ErrorResponse, getCedearPanel } from '@/server/cedears'

const MAX_TICKERS = 50

/** GET /api/cedears/prices?tickers=AAPL,BA.C → `CedearPriceMap`; los tickers desconocidos se omiten */
export async function GET(request: NextRequest) {
  const tickers = [
    ...new Set(
      (request.nextUrl.searchParams.get('tickers') ?? '')
        .split(',')
        .map((ticker) => ticker.trim().toUpperCase())
        .filter(Boolean),
    ),
  ]
  if (tickers.length === 0) return Response.json({})
  if (tickers.length > MAX_TICKERS || !tickers.every((ticker) => CEDEAR_TICKER.test(ticker))) {
    return Response.json({ error: 'Parámetro tickers inválido.' }, { status: 400 })
  }

  try {
    // Un solo panel con todos los CEDEARs: la misma consulta (y el mismo cache) para cualquier lista
    const { rows, updatedAt } = await getCedearPanel()
    const wanted = new Set(tickers)
    const prices: CedearPriceMap = {}
    for (const row of rows) {
      if (wanted.has(row.ticker)) {
        prices[row.ticker] = { priceArs: row.priceArs, change24h: row.change24h, updatedAt }
      }
    }
    return Response.json(prices)
  } catch (error) {
    return data912ErrorResponse(error)
  }
}
