import type { NextRequest } from 'next/server'
import { getDolarHistory, type DolarHistoryPoint } from '@/server/argentinadatos'
import { COIN_HISTORY_DAYS } from '@/server/coingecko'
import { DolarOption } from '@/types/dolar.types'

const OPTIONS = new Set<string>(Object.values(DolarOption))

/**
 * GET /api/history/dolar?casas=blue,cripto → `{ [casa]: DolarHistoryPoint[] }`
 * Cotización diaria del último año (mismo período que la historia de cripto).
 */
export async function GET(request: NextRequest) {
  const casas = [
    ...new Set(
      (request.nextUrl.searchParams.get('casas') ?? '')
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
    ),
  ]
  if (casas.length === 0) return Response.json({})
  if (!casas.every((c) => OPTIONS.has(c))) {
    return Response.json({ error: 'Parámetro casas inválido.' }, { status: 400 })
  }

  const from = new Date(Date.now() - (COIN_HISTORY_DAYS + 1) * 86_400_000)
    .toISOString()
    .slice(0, 10)
  try {
    const entries = await Promise.all(
      casas.map(
        async (casa) =>
          [casa, await getDolarHistory(casa as DolarOption, from)] as [string, DolarHistoryPoint[]],
      ),
    )
    return Response.json(Object.fromEntries(entries))
  } catch (error) {
    console.error('ArgentinaDatos:', error)
    return Response.json(
      { error: 'No se pudo obtener el histórico del dólar.' },
      { status: 502 },
    )
  }
}
