import { format } from 'date-fns'
import { requestJson } from '@/lib/http'
import type { UsdtSwapDirection } from './operations'

/**
 * Cotización del dólar cripto para la pata en pesos de un intercambio. Entregar USDT equivale
 * a venderlos (el mercado paga `compra`); recibirlos, a comprarlos (cuesta `venta`): la misma
 * punta que usaría una operación normal del módulo Dólar ese día.
 */

export type DolarHistoryPoint = { date: string; buy: number; sell: number }

export const rateSide = (direction: UsdtSwapDirection) =>
  direction === 'USDT_TO_COIN' ? 'buy' : 'sell'

/**
 * Cotización de `day` o, si ese día no hubo (feriado, fin de semana), la del último día anterior.
 * `null` si la fecha es anterior al histórico: nunca se inventa una cotización.
 */
export const rateOn = (
  points: DolarHistoryPoint[],
  day: Date,
  direction: UsdtSwapDirection,
): { rate: number; date: string } | null => {
  const key = format(day, 'yyyy-MM-dd')
  let found: DolarHistoryPoint | undefined
  for (const point of points) {
    if (point.date > key) break
    found = point
  }
  return found ? { rate: found[rateSide(direction)], date: found.date } : null
}

/** Histórico del último año (`/api/history/dolar`, cacheado en el server) */
export const fetchCriptoHistory = async () =>
  (await requestJson<{ cripto?: DolarHistoryPoint[] }>('/api/history/dolar?casas=cripto')).cripto ??
  []
