import type { NextRequest } from 'next/server'
import { CEDEAR_TICKER } from '@/features/cedears/catalog'
import type { CedearHistoryPoint } from '@/features/cedears/types'
import { data912ErrorResponse, getCedearHistory } from '@/server/cedears'
import { COIN_HISTORY_DAYS } from '@/server/coingecko'

const MAX_TICKERS = 20

/**
 * GET /api/history/cedears?tickers=AAPL,BA.C → `{ [ticker]: CedearHistoryPoint[] }`
 * Cierre diario en ARS del último año (mismo período que el resto del gráfico). Un ticker sin
 * histórico en data912 se omite. Sin ajustar por cambios de ratio.
 */
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

  const from = new Date(Date.now() - (COIN_HISTORY_DAYS + 1) * 86_400_000)
    .toISOString()
    .slice(0, 10)
  try {
    const history: Record<string, CedearHistoryPoint[]> = {}
    // En serie: data912 es un servicio chico y gratuito
    for (const ticker of tickers) {
      const points = await getCedearHistory(ticker, from)
      if (points) history[ticker] = points
    }
    return Response.json(history)
  } catch (error) {
    return data912ErrorResponse(error)
  }
}
