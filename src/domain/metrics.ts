import {
  TransactionType,
  type Transaction,
  type TransactionsData,
} from '@/types/transaction.types'

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
  let totalUsd = 0
  let totalPesosCosto = 0
  let averageCost = 0
  let realizedProfit = 0

  for (const tx of txs) {
    const dollarsAmount = Number(tx.dollarsAmount) || 0
    const pesosAmount = Number(tx.pesosAmount) || 0

    if (tx.type === TransactionType.BUY) {
      totalPesosCosto += pesosAmount
      totalUsd += dollarsAmount
      averageCost = totalUsd > 0 ? totalPesosCosto / totalUsd : 0
    }

    if (tx.type === TransactionType.SELL) {
      const precioVentaUnitario =
        dollarsAmount > 0 ? pesosAmount / dollarsAmount : 0
      const ganancia = (precioVentaUnitario - averageCost) * dollarsAmount

      realizedProfit += ganancia
      totalUsd -= dollarsAmount
      // Prevenir errores de coma flotante que dejen totalUsd en algo como 0.000000001
      if (totalUsd < 0.0001) totalUsd = 0

      totalPesosCosto = totalUsd * averageCost
    }
  }

  let unrealizedProfit = 0
  let marketValuePesos = totalPesosCosto

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
    investedPesos: Number(totalPesosCosto.toFixed(2)),
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
