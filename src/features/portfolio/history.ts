import { addDays, format, parse } from 'date-fns'
import { toPositionLot } from '@/features/crypto/metrics'
import type { CryptoTransaction } from '@/features/crypto/types'
import type { PesosMovement } from '@/features/pesos/types'
import { DolarOption } from '@/types/dolar.types'
import { TransactionType, type Transaction } from '@/types/transaction.types'

/**
 * Evolución del valor del portfolio, reconstruida (no guardada): para cada día, lo que
 * se tenía según las transacciones × el precio de ese día. Siempre coherente con los
 * datos actuales, aunque se edite el pasado, y funciona igual en modo local y en la nube.
 *
 * Mismas convenciones que el dashboard: dólar a la cotización de venta de su tipo,
 * cripto en USD y a pesos con el dólar cripto compra, pesos a USD con el MEP venta. Días sin cotización (fines de
 * semana, feriados) usan la última conocida. Si un activo en cartera todavía no tiene
 * precio ese día, el valor del día es `null`: no se inventa.
 */

/** `yyyy-MM-dd` */
export type DateKey = string

export type DolarPricePoint = { date: DateKey; buy: number; sell: number }
export type CoinPricePoint = { date: DateKey; usd: number }

export type ValuePoint = { date: DateKey; usd: number | null; ars: number | null }

export type HistoryInput = {
  dolarTxs: Transaction[]
  cryptoTxs: CryptoTransaction[]
  /** Movimientos de Pesos (Fase 8); el saldo se pasa a USD con el MEP venta del día */
  pesosMovements?: PesosMovement[]
  dolarPrices: Partial<Record<DolarOption, DolarPricePoint[]>>
  coinPrices: Record<string, CoinPricePoint[]>
  from: DateKey
  to: DateKey
}

/** Día local de una fecha de transacción (las guarda el `<Calendar>` como medianoche local) */
export const toDateKey = (date: Date | string): DateKey => format(new Date(date), 'yyyy-MM-dd')

const parseKey = (key: DateKey) => parse(key, 'yyyy-MM-dd', new Date())

export const eachDateKey = (from: DateKey, to: DateKey): DateKey[] => {
  const keys: DateKey[] = []
  for (let d = parseKey(from); toDateKey(d) <= to; d = addDays(d, 1)) keys.push(toDateKey(d))
  return keys
}

/** Último punto con `date ≤ key` (series ordenadas por fecha), o `null` */
export const priceAt = <T extends { date: DateKey }>(series: T[] | undefined, key: DateKey) => {
  if (!series?.length) return null
  let lo = 0
  let hi = series.length - 1
  let found: T | null = null
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (series[mid].date <= key) {
      found = series[mid]
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return found
}

type Delta = { date: DateKey; asset: string; quantity: number }

// Mismo criterio de "polvo" que el motor (`computePosition`): restos de coma flotante
const DOLAR_DUST = 0.0001
const COIN_DUST = 1e-9
const PESOS_DUST = 0.005

export const computeValueHistory = ({
  dolarTxs,
  cryptoTxs,
  pesosMovements = [],
  dolarPrices,
  coinPrices,
  from,
  to,
}: HistoryInput): ValuePoint[] => {
  const signed = (type: TransactionType, quantity: number) =>
    type === TransactionType.BUY ? quantity : -quantity
  const deltas: Delta[] = [
    ...dolarTxs.map((tx) => ({
      date: toDateKey(tx.date),
      asset: `dolar:${tx.dolarOption}`,
      quantity: signed(tx.type, tx.dollarsAmount),
    })),
    // La comisión en la moneda también mueve unidades (igual que la línea temporal)
    ...cryptoTxs.map((tx) => ({
      date: toDateKey(tx.date),
      asset: `crypto:${tx.coinId}`,
      quantity: signed(tx.type, toPositionLot(tx).quantity),
    })),
    ...pesosMovements.map((m) => ({
      date: toDateKey(m.date),
      asset: 'pesos:ars',
      quantity: signed(m.type, m.amount),
    })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  const holdings = new Map<string, number>()
  let next = 0
  const points: ValuePoint[] = []

  for (const day of eachDateKey(from, to)) {
    // Todo lo operado hasta este día inclusive (lo anterior a `from` entra el primer día)
    while (next < deltas.length && deltas[next].date <= day) {
      const { asset, quantity } = deltas[next++]
      holdings.set(asset, (holdings.get(asset) ?? 0) + quantity)
    }

    let usd: number | null = 0
    let ars: number | null = 0
    const cryptoRate = priceAt(dolarPrices[DolarOption.Cripto], day)?.buy ?? null
    const mepRate = priceAt(dolarPrices[DolarOption.Bolsa], day)?.sell ?? null

    for (const [asset, quantity] of holdings) {
      const [module, id] = asset.split(':')
      if (module === 'dolar') {
        if (quantity <= DOLAR_DUST) continue
        const price = priceAt(dolarPrices[id as DolarOption], day)
        if (usd !== null) usd += quantity
        ars = ars === null || !price ? null : ars + quantity * price.sell
      } else if (module === 'pesos') {
        if (quantity <= PESOS_DUST) continue
        if (ars !== null) ars += quantity
        usd = usd === null || mepRate === null ? null : usd + quantity / mepRate
      } else {
        if (quantity <= COIN_DUST) continue
        const price = priceAt(coinPrices[id], day)
        if (!price) {
          usd = null
          ars = null
          continue
        }
        const value = quantity * price.usd
        if (usd !== null) usd += value
        ars = ars === null || cryptoRate === null ? null : ars + value * cryptoRate
      }
    }

    points.push({ date: day, usd, ars })
  }

  return points
}

/**
 * Saca los días iniciales sin valor en la moneda elegida (activos sin precio todavía).
 * `gapUntil`: primer día con valor, si hubo que recortar.
 */
export const trimLeadingGaps = (points: ValuePoint[], currency: 'usd' | 'ars') => {
  const first = points.findIndex((p) => p[currency] !== null)
  if (first <= 0) return { points: first === -1 ? [] : points, gapUntil: null }
  return { points: points.slice(first), gapUntil: points[first].date }
}
