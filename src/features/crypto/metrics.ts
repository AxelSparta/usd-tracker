import { computePosition } from '@/domain/position'
import { sortTxs } from '@/domain/timeline'
import type {
  Coin,
  CoinPriceMap,
  CryptoPortfolioSummary,
  CryptoPosition,
  CryptoTransaction,
} from './types'

/** Agrupa por moneda y ordena cada grupo cronológicamente. */
export const groupByCoin = (
  txs: CryptoTransaction[],
): Record<string, CryptoTransaction[]> => {
  const groups: Record<string, CryptoTransaction[]> = {}
  for (const tx of txs) {
    ;(groups[tx.coinId] ??= []).push(tx)
  }
  for (const coinId of Object.keys(groups)) {
    groups[coinId] = sortTxs(groups[coinId])
  }
  return groups
}

/**
 * Posiciones por moneda (costo promedio en USD, PnL realizado y no realizado).
 * Incluye monedas ya vendidas por completo, que conservan su PnL realizado.
 * Orden: mayor valor de mercado primero; sin precio, por inversión.
 */
export const computeCryptoPositions = (
  txs: CryptoTransaction[],
  coins: Record<string, Coin>,
  prices: CoinPriceMap,
): CryptoPosition[] => {
  const positions: CryptoPosition[] = []

  for (const [coinId, group] of Object.entries(groupByCoin(txs))) {
    const coin = coins[coinId]
    if (!coin) continue

    const { quantity, invested, averageCost, realizedProfit } = computePosition(
      group.map((tx) => ({
        type: tx.type,
        quantity: tx.quantity,
        quoteAmount: tx.quantity * tx.priceUsd,
      })),
    )

    const price = prices[coinId]
    const marketValueUsd = price ? quantity * price.usd : null
    const unrealizedPnlUsd =
      marketValueUsd === null ? null : marketValueUsd - invested

    positions.push({
      coin,
      quantity,
      investedUsd: invested,
      averageCostUsd: averageCost,
      realizedPnlUsd: realizedProfit,
      priceUsd: price?.usd ?? null,
      change24h: price?.change24h ?? null,
      marketValueUsd,
      unrealizedPnlUsd,
      unrealizedPnlPct:
        unrealizedPnlUsd !== null && invested > 0
          ? (unrealizedPnlUsd / invested) * 100
          : null,
    })
  }

  return positions.sort(
    (a, b) =>
      (b.marketValueUsd ?? b.investedUsd) - (a.marketValueUsd ?? a.investedUsd),
  )
}

export const summarizePortfolio = (
  positions: CryptoPosition[],
): CryptoPortfolioSummary => {
  const summary: CryptoPortfolioSummary = {
    investedUsd: 0,
    marketValueUsd: 0,
    unrealizedPnlUsd: 0,
    realizedPnlUsd: 0,
    hasMissingPrices: false,
  }

  for (const p of positions) {
    summary.investedUsd += p.investedUsd
    summary.realizedPnlUsd += p.realizedPnlUsd
    if (p.marketValueUsd === null) {
      if (p.quantity > 0) summary.hasMissingPrices = true
      continue
    }
    summary.marketValueUsd += p.marketValueUsd
    summary.unrealizedPnlUsd += p.unrealizedPnlUsd ?? 0
  }

  return summary
}
