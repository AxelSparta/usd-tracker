import type { NextRequest } from 'next/server'
import type { Cedear } from '@/features/cedears/types'
import { data912ErrorResponse, getCedearPanel, type CedearPanelRow } from '@/server/cedears'

const LIMIT = 10

/** Monto operado en el día (ARS): ordena mejor que la cantidad, que favorece a los CEDEARs baratos */
const traded = (row: CedearPanelRow) => row.volume * (row.priceArs ?? 0)

/**
 * GET /api/cedears/search?q=apple → `Cedear[]` (solo tickers en ARS). Busca por ticker (prefijo) y
 * por nombre del catálogo; el ticker exacto va primero y el resto, por monto operado. Sin `q`, los
 * más operados del día.
 */
export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 50)

  try {
    const { rows } = await getCedearPanel()
    const upper = query.toUpperCase()
    const lower = query.toLowerCase()
    const matches = query
      ? rows.filter(
          (row) => row.ticker.startsWith(upper) || row.name?.toLowerCase().includes(lower),
        )
      : rows
    const sorted = [...matches].sort(
      (a, b) =>
        Number(b.ticker === upper) - Number(a.ticker === upper) || traded(b) - traded(a),
    )
    return Response.json(
      sorted.slice(0, LIMIT).map(({ ticker, name }): Cedear => ({ ticker, name })),
    )
  } catch (error) {
    return data912ErrorResponse(error)
  }
}
