import { computePosition, type PositionLot } from '@/domain/position'
import { sortTxs } from '@/domain/timeline'
import { TransactionType } from '@/types/transaction.types'
import type {
  CedearPosition,
  CedearPriceMap,
  CedearSummary,
  CedearTransaction,
} from './types'

/**
 * Monto total de la operación en su moneda, con la comisión: lo que sale en una compra
 * (`price × quantity + fee`) o lo que entra en una venta (`price × quantity − fee`). Es también
 * el monto de su pata (Pesos o Dólar CCL).
 */
export const cedearTotal = (tx: Pick<CedearTransaction, 'type' | 'quantity' | 'price' | 'fee'>) => {
  const gross = tx.quantity * tx.price
  const fee = tx.fee ?? 0
  return tx.type === TransactionType.BUY ? gross + fee : gross - fee
}

/** El total en ARS y en USD, convertido con el CCL de la operación (D4) */
export const cedearAmounts = (tx: CedearTransaction): { ars: number; usd: number } => {
  const total = cedearTotal(tx)
  return tx.currency === 'ARS'
    ? { ars: total, usd: total / tx.fxRate }
    : { ars: total * tx.fxRate, usd: total }
}

/** Lote del motor en ARS: `quoteAmount` = monto ARS (si se pagó en CCL, USD × `fxRate`) */
export const toArsLot = (tx: CedearTransaction): PositionLot => ({
  type: tx.type,
  quantity: tx.quantity,
  quoteAmount: cedearAmounts(tx).ars,
})

/** Lote del motor en USD: `quoteAmount` = monto USD (si se pagó en pesos, ARS / `fxRate`) */
export const toUsdLot = (tx: CedearTransaction): PositionLot => ({
  type: tx.type,
  quantity: tx.quantity,
  quoteAmount: cedearAmounts(tx).usd,
})

/** Agrupa por ticker y ordena cada grupo cronológicamente */
export const groupByTicker = (
  txs: CedearTransaction[],
): Record<string, CedearTransaction[]> => {
  const groups: Record<string, CedearTransaction[]> = {}
  for (const tx of txs) {
    ;(groups[tx.ticker] ??= []).push(tx)
  }
  for (const ticker of Object.keys(groups)) {
    groups[ticker] = sortTxs(groups[ticker])
  }
  return groups
}

/**
 * Posiciones por ticker con el mismo motor en las dos monedas. Valuación en vivo (D5): cantidad ×
 * último precio ARS; en USD, ese valor / CCL venta (`cclSell`). Sin precio (o sin CCL, en USD) →
 * `null`, nunca inventado. Incluye tickers ya vendidos por completo (conservan su PnL realizado).
 * Orden: mayor valor de mercado primero; sin precio, por costo.
 */
export const computeCedearPositions = (
  txs: CedearTransaction[],
  prices: CedearPriceMap,
  cclSell: number | null,
): CedearPosition[] => {
  const positions: CedearPosition[] = []

  for (const [ticker, group] of Object.entries(groupByTicker(txs))) {
    const ars = computePosition(group.map(toArsLot))
    const usd = computePosition(group.map(toUsdLot))

    const priceArs = prices[ticker]?.priceArs ?? null
    const marketValueArs = priceArs === null ? null : ars.quantity * priceArs
    const marketValueUsd =
      marketValueArs === null || !cclSell ? null : marketValueArs / cclSell

    positions.push({
      ticker,
      quantity: ars.quantity,
      costArs: ars.invested,
      costUsd: usd.invested,
      averageCostArs: ars.averageCost,
      averageCostUsd: usd.averageCost,
      realizedPnlArs: ars.realizedProfit,
      realizedPnlUsd: usd.realizedProfit,
      priceArs,
      change24h: prices[ticker]?.change24h ?? null,
      marketValueArs,
      marketValueUsd,
      unrealizedPnlArs: marketValueArs === null ? null : marketValueArs - ars.invested,
      unrealizedPnlUsd: marketValueUsd === null ? null : marketValueUsd - usd.invested,
    })
  }

  return positions.sort(
    (a, b) => (b.marketValueArs ?? b.costArs) - (a.marketValueArs ?? a.costArs),
  )
}

export const summarizeCedears = (positions: CedearPosition[]): CedearSummary => {
  const summary: CedearSummary = {
    costArs: 0,
    costUsd: 0,
    marketValueArs: 0,
    marketValueUsd: 0,
    unrealizedPnlArs: 0,
    unrealizedPnlUsd: 0,
    realizedPnlArs: 0,
    realizedPnlUsd: 0,
    hasMissingPrices: false,
  }

  for (const p of positions) {
    summary.costArs += p.costArs
    summary.costUsd += p.costUsd
    summary.realizedPnlArs += p.realizedPnlArs
    summary.realizedPnlUsd += p.realizedPnlUsd
    if (p.quantity > 0 && (p.marketValueArs === null || p.marketValueUsd === null)) {
      summary.hasMissingPrices = true
    }
    if (p.marketValueArs !== null) {
      summary.marketValueArs += p.marketValueArs
      summary.unrealizedPnlArs += p.unrealizedPnlArs ?? 0
    }
    if (p.marketValueUsd !== null) {
      summary.marketValueUsd += p.marketValueUsd
      summary.unrealizedPnlUsd += p.unrealizedPnlUsd ?? 0
    }
  }

  return summary
}
