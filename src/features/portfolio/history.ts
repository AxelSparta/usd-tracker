import { addDays, format, parse } from 'date-fns'
import { cedearAmounts } from '@/features/cedears/metrics'
import type { CedearTransaction } from '@/features/cedears/types'
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
 * cripto en USD y a pesos con el dólar cripto compra, pesos a USD con el MEP venta, CEDEARs a su
 * cierre en pesos y a USD con el CCL venta. Días sin cotización (fines de semana, feriados) usan la
 * última conocida. Si la fuente no tiene cotización de un activo (data912 no tiene histórico de
 * muchos CEDEARs, p. ej. IBIT), cuenta el precio de las propias operaciones de ese día
 * (`withOperationPrices`). Si un activo en cartera todavía no tiene ningún precio ese día, el
 * valor del día es `null`: no se inventa.
 */

/** `yyyy-MM-dd` */
export type DateKey = string

export type DolarPricePoint = { date: DateKey; buy: number; sell: number }
export type CoinPricePoint = { date: DateKey; usd: number }
/** Cierre de un CEDEAR en ARS (data912, sin ajustar por cambios de ratio) */
export type CedearPricePoint = { date: DateKey; ars: number }

export type ValuePoint = { date: DateKey; usd: number | null; ars: number | null }

export type HistoryInput = {
  dolarTxs: Transaction[]
  cryptoTxs: CryptoTransaction[]
  /** Movimientos de Pesos (Fase 8); el saldo se pasa a USD con el MEP venta del día */
  pesosMovements?: PesosMovement[]
  /** Operaciones de CEDEARs (Fase 10); se valúan a su cierre en ARS y a USD con el CCL venta del día */
  cedearTxs?: CedearTransaction[]
  cedearPrices?: Record<string, CedearPricePoint[]>
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

/**
 * Agrega a la serie de mercado el precio de las operaciones en los días que no tiene cotización
 * (la de mercado manda). Es un precio real, el pagado o cobrado, sin la comisión.
 */
export const withOperationPrices = <T extends { date: DateKey }>(
  series: T[] | undefined,
  operations: T[],
): T[] => {
  const market = series ?? []
  const known = new Set(market.map((p) => p.date))
  const extra = new Map<DateKey, T>()
  // Varias operaciones el mismo día: la última
  for (const op of operations) if (!known.has(op.date)) extra.set(op.date, op)
  if (extra.size === 0) return market
  return [...market, ...extra.values()].sort((a, b) => a.date.localeCompare(b.date))
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
  cedearTxs = [],
  cedearPrices = {},
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
    ...cedearTxs.map((tx) => ({
      date: toDateKey(tx.date),
      asset: `cedear:${tx.ticker}`,
      quantity: signed(tx.type, tx.quantity),
    })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  const operationPrices = <T extends { date: DateKey }>(
    series: Record<string, T[]>,
    points: [string, T][],
  ) => {
    const byAsset = new Map<string, T[]>()
    for (const [id, point] of points) byAsset.set(id, [...(byAsset.get(id) ?? []), point])
    const merged = { ...series }
    for (const [id, ops] of byAsset) {
      merged[id] = withOperationPrices(series[id], ops.sort((a, b) => a.date.localeCompare(b.date)))
    }
    return merged
  }
  const cedearSeries = operationPrices<CedearPricePoint>(
    cedearPrices,
    cedearTxs
      .filter((tx) => tx.price > 0)
      .map((tx) => [
        tx.ticker,
        // Precio por CEDEAR en ARS, sin comisión
        { date: toDateKey(tx.date), ars: cedearAmounts({ ...tx, fee: 0 }).ars / tx.quantity },
      ]),
  )
  const coinSeries = operationPrices<CoinPricePoint>(
    coinPrices,
    cryptoTxs
      .filter((tx) => tx.priceUsd > 0)
      .map((tx) => [tx.coinId, { date: toDateKey(tx.date), usd: tx.priceUsd }]),
  )

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
    const cclRate = priceAt(dolarPrices[DolarOption.ContadoConLiqui], day)?.sell ?? null

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
      } else if (module === 'cedear') {
        // CEDEARs enteros: no hay polvo
        if (quantity <= 0) continue
        const price = priceAt(cedearSeries[id], day)
        if (!price) {
          usd = null
          ars = null
          continue
        }
        const value = quantity * price.ars
        if (ars !== null) ars += value
        usd = usd === null || cclRate === null ? null : usd + value / cclRate
      } else {
        if (quantity <= COIN_DUST) continue
        const price = priceAt(coinSeries[id], day)
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
