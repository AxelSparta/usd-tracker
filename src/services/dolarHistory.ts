import { format } from 'date-fns'
import { requestJson } from '@/lib/http'

/**
 * Cotización histórica del dólar cripto (pesos por USDT) para valuar en ARS las operaciones de
 * USDT que no son compras ni ventas con pesos: intercambios USDT ↔ cripto y resultados de trades.
 * Punta: `buy` (el mercado paga `compra`) cuando salen USDT, `sell` (cuesta `venta`) cuando entran,
 * la misma que usaría una operación normal del módulo Dólar ese día.
 */

export type DolarHistoryPoint = { date: string; buy: number; sell: number }

export type QuoteSide = 'buy' | 'sell'

/**
 * Cotización de `day` o, si ese día no hubo (feriado, fin de semana), la del último día anterior.
 * `null` si la fecha es anterior al histórico: nunca se inventa una cotización.
 */
export const rateOn = (
  points: DolarHistoryPoint[],
  day: Date,
  side: QuoteSide,
): { rate: number; date: string } | null => {
  const key = format(day, 'yyyy-MM-dd')
  let found: DolarHistoryPoint | undefined
  for (const point of points) {
    if (point.date > key) break
    found = point
  }
  return found ? { rate: found[side], date: found.date } : null
}

/** Histórico del último año (`/api/history/dolar`, cacheado en el server) */
export const fetchCriptoHistory = async () =>
  (await requestJson<{ cripto?: DolarHistoryPoint[] }>('/api/history/dolar?casas=cripto')).cripto ??
  []
