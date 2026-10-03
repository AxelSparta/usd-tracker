import { z } from 'zod'
import type { DolarOption } from '@/types/dolar.types'

/**
 * Cotizaciones históricas del dólar (ArgentinaDatos, sin API key). Solo server: el
 * Data Cache de Next comparte las respuestas entre usuarios. El histórico completo de
 * cada tipo de dólar pesa < 1 MB; al cliente se le manda solo el período pedido.
 */

const BASE_URL = 'https://api.argentinadatos.com/v1'

export class ArgentinaDatosError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

const historySchema = z.array(
  z.object({
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    compra: z.number().nullish(),
    venta: z.number().nullish(),
  }),
)

export type DolarHistoryPoint = { date: string; buy: number; sell: number }

/** Cotización diaria (`date` = `yyyy-MM-dd`) desde `from` inclusive, ordenada por fecha */
export const getDolarHistory = async (
  casa: DolarOption,
  from: string,
): Promise<DolarHistoryPoint[]> => {
  const response = await fetch(`${BASE_URL}/cotizaciones/dolares/${casa}`, {
    headers: { accept: 'application/json' },
    // El pasado no cambia; solo se agrega el día de hoy
    next: { revalidate: 6 * 60 * 60 },
  })
  if (!response.ok) {
    throw new ArgentinaDatosError(`ArgentinaDatos respondió ${response.status}`, response.status)
  }
  return historySchema
    .parse(await response.json())
    .filter((p) => p.fecha >= from && p.compra != null && p.venta != null)
    .map((p) => ({ date: p.fecha, buy: p.compra!, sell: p.venta! }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
