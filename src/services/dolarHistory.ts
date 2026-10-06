import { format } from 'date-fns'
import { requestJson } from '@/lib/http'
import type { DolarOption } from '@/types/dolar.types'

/**
 * Cotización histórica de un tipo de dólar (pesos por USD), como referencia en los formularios:
 * el dólar cripto para valuar intercambios USDT ↔ cripto y resultados de trades; cualquier tipo
 * para las conversiones de pesos. Punta: `buy` (el mercado paga `compra`) cuando salen dólares,
 * `sell` (cuesta `venta`) cuando entran, la misma que usaría una operación normal del Dólar.
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

/** Histórico del último año de un tipo de dólar (`/api/history/dolar`, cacheado en el server) */
export const fetchDolarHistory = async (option: DolarOption) =>
  (
    await requestJson<Partial<Record<DolarOption, DolarHistoryPoint[]>>>(
      `/api/history/dolar?casas=${option}`,
    )
  )[option] ?? []
