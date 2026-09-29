import type { Transaction, TransactionsData } from '@/types/transaction.types'
import { computePosition } from './position'

/** Cotización actual de un activo (en ARS por unidad) */
export type MarketPrice = { buy: number; sell: number }

export type MarketPriceMap<K extends string = string> = Partial<
  Record<K, MarketPrice>
>

/**
 * Métricas de un grupo de transacciones del mismo activo, ya ordenadas con `sortTxs`.
 * Costo promedio ponderado; la ganancia no realizada marca a mercado con `marketPrice.sell`.
 */
export const computeGroupMetrics = (
  txs: Transaction[],
  marketPrice?: MarketPrice,
): TransactionsData => {
  const { quantity: totalUsd, invested, averageCost, realizedProfit } =
    computePosition(
      txs.map((tx) => ({
        type: tx.type,
        quantity: tx.dollarsAmount,
        quoteAmount: tx.pesosAmount,
      })),
      { dust: 0.0001 },
    )

  let unrealizedProfit = 0
  let marketValuePesos = invested

  if (marketPrice && totalUsd > 0) {
    const sellPrice = Number(marketPrice.sell) || 0
    marketValuePesos = totalUsd * sellPrice
    unrealizedProfit = marketValuePesos - totalUsd * averageCost
  } else if (totalUsd === 0) {
    marketValuePesos = 0
    unrealizedProfit = 0
  }

  return {
    totalUsd: Number(totalUsd.toFixed(4)),
    investedPesos: Number(invested.toFixed(2)),
    marketValuePesos: Number(marketValuePesos.toFixed(2)),
    averageCost: Number(averageCost.toFixed(2)),
    realizedProfit: Number(realizedProfit.toFixed(2)),
    unrealizedProfit: Number(unrealizedProfit.toFixed(2)),
  }
}

/** Métricas por grupo; los grupos vacíos se omiten */
export const computeTransactionsData = <K extends string>(
  groupedTxs: Partial<Record<K, Transaction[]>>,
  prices: MarketPriceMap<K>,
): Partial<Record<K, TransactionsData>> => {
  const result: Partial<Record<K, TransactionsData>> = {}

  for (const key of Object.keys(groupedTxs) as K[]) {
    const txs = groupedTxs[key] || []
    if (txs.length === 0) continue
    result[key] = computeGroupMetrics(txs, prices[key])
  }

  return result
}
