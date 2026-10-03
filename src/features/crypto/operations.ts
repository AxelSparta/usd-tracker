import { format } from 'date-fns'
import { findNegativeBalance, sortTxs } from '@/domain/timeline'
import { USDT_SWAP_LEG_REMOVE, USDT_SWAP_LEG_UPDATE } from '@/domain/transactions'
import { TRADE_RESULT, TransactionType } from '@/types/transaction.types'
import { toPositionLot } from './metrics'
import type { Coin, CryptoTransaction } from './types'

/**
 * Operaciones del módulo cripto. Puras: devuelven el estado nuevo o lanzan `Error`
 * (mensaje en español) si la línea temporal de alguna moneda queda sin saldo.
 * Las usan el store (cliente) y la API (server), así los dos validan igual.
 */

export type CryptoPortfolioState = {
  /** Lista plana; la agrupación por moneda se deriva (`groupByCoin`) */
  transactions: CryptoTransaction[]
  /** Metadatos de cada moneda usada, para no depender de CoinGecko al mostrarla */
  coins: Record<string, Coin>
}

/** Intercambio cripto ↔ cripto: se guarda como una venta y una compra enlazadas */
export type CryptoSwapInput = {
  from: Coin
  fromQuantity: number
  to: Coin
  toQuantity: number
  /** Valor del intercambio en USD: define el precio de venta y el costo de la compra */
  valueUsd: number
  date: Date | string
}

/** Ids que genera el cliente para las dos patas (y el enlace) de un intercambio */
export type SwapIds = { swapId: string; sellId: string; buyId: string }

const formatDate = (date: Date | string) => format(new Date(date), 'dd/MM/yyyy')

/** Lanza si alguna venta de la moneda supera el saldo disponible a esa fecha */
export const assertCoinTimeline = (
  txs: CryptoTransaction[],
  coin: Coin | undefined,
  message: (symbol: string, date: string) => string,
) => {
  // Saldo real: la comisión en la moneda también mueve unidades
  const offending = findNegativeBalance(
    sortTxs(txs),
    (tx) => toPositionLot(tx).quantity,
  )
  if (offending) {
    throw new Error(message(coin?.symbol ?? 'la moneda', formatDate(offending.date)))
  }
}

/** Un resultado de trade es el neto acreditado: sin comisión ni enlace de intercambio */
export const assertCryptoShape = (tx: Omit<CryptoTransaction, 'id'>) => {
  if (tx.kind !== TRADE_RESULT) return
  if (tx.fee) throw new Error('Un resultado de trade no lleva comisión: cargá el neto.')
  if (tx.swapId || tx.usdtSwapId) {
    throw new Error('Un resultado de trade no puede ser parte de un intercambio.')
  }
}

export const applyAddCryptoTransaction = (
  { transactions, coins }: CryptoPortfolioState,
  tx: CryptoTransaction,
  coin: Coin,
): CryptoPortfolioState => {
  assertCryptoShape(tx)
  assertCoinTimeline(
    [...transactions.filter((t) => t.coinId === tx.coinId), tx],
    coin,
    (symbol, date) => `No tenés suficiente ${symbol} para vender el ${date}.`,
  )
  return {
    transactions: [...transactions, tx],
    coins: { ...coins, [coin.id]: coin },
  }
}

/** `null` si la operación no existe */
export const applyUpdateCryptoTransaction = (
  { transactions, coins }: CryptoPortfolioState,
  transactionId: string,
  tx: Omit<CryptoTransaction, 'id'>,
  coin: Coin,
): CryptoPortfolioState | null => {
  const previous = transactions.find((t) => t.id === transactionId)
  if (!previous) return null
  if (previous.swapId) {
    throw new Error('Los intercambios no se editan: borralo y cargalo de nuevo.')
  }
  if (previous.usdtSwapId) throw new Error(USDT_SWAP_LEG_UPDATE)
  assertCryptoShape(tx)

  const updated = transactions.map((t) =>
    t.id === transactionId ? { id: transactionId, ...tx } : t,
  )

  assertCoinTimeline(
    updated.filter((t) => t.coinId === tx.coinId),
    coin,
    (symbol, date) => `No tenés suficiente ${symbol} para la venta del ${date}.`,
  )
  // Si cambió la moneda, la de origen pierde esta operación
  if (previous.coinId !== tx.coinId) {
    assertCoinTimeline(
      updated.filter((t) => t.coinId === previous.coinId),
      coins[previous.coinId],
      (symbol, date) =>
        `No se puede cambiar: la venta de ${symbol} del ${date} quedaría sin saldo.`,
    )
  }

  return { transactions: updated, coins: { ...coins, [coin.id]: coin } }
}

/** Venta de `from` + compra de `to`, con el precio de cada pata = valor USD / cantidad */
export const buildSwapLegs = (
  { from, fromQuantity, to, toQuantity, valueUsd, date }: CryptoSwapInput,
  { swapId, sellId, buyId }: SwapIds,
): [CryptoTransaction, CryptoTransaction] => [
  {
    id: sellId,
    coinId: from.id,
    type: TransactionType.SELL,
    quantity: fromQuantity,
    priceUsd: valueUsd / fromQuantity,
    date,
    swapId,
  },
  {
    id: buyId,
    coinId: to.id,
    type: TransactionType.BUY,
    quantity: toQuantity,
    priceUsd: valueUsd / toQuantity,
    date,
    swapId,
  },
]

export const applyAddSwap = (
  { transactions, coins }: CryptoPortfolioState,
  swap: CryptoSwapInput,
  ids: SwapIds,
): CryptoPortfolioState => {
  const { from, to } = swap
  if (from.id === to.id) {
    throw new Error('Elegí dos monedas distintas para el intercambio.')
  }
  const [sellLeg, buyLeg] = buildSwapLegs(swap, ids)

  assertCoinTimeline(
    [...transactions.filter((t) => t.coinId === from.id), sellLeg],
    from,
    (symbol, day) => `No tenés suficiente ${symbol} para intercambiar el ${day}.`,
  )

  return {
    transactions: [...transactions, sellLeg, buyLeg],
    coins: { ...coins, [from.id]: from, [to.id]: to },
  }
}

/**
 * Si es una pata de un intercambio, borra también la otra.
 * `null` si la operación no existe; si no, el estado nuevo y los ids borrados.
 */
export const applyRemoveCryptoTransaction = (
  { transactions, coins }: CryptoPortfolioState,
  transactionId: string,
): { state: CryptoPortfolioState; removedIds: string[] } | null => {
  const target = transactions.find((t) => t.id === transactionId)
  if (!target) return null
  if (target.usdtSwapId) throw new Error(USDT_SWAP_LEG_REMOVE)

  const removed = transactions.filter((t) =>
    target.swapId ? t.swapId === target.swapId : t.id === transactionId,
  )
  const remaining = transactions.filter((t) => !removed.includes(t))
  for (const coinId of new Set(removed.map((t) => t.coinId))) {
    assertCoinTimeline(
      remaining.filter((t) => t.coinId === coinId),
      coins[coinId],
      (symbol, date) =>
        `No se puede eliminar: la venta de ${symbol} del ${date} quedaría sin saldo.`,
    )
  }

  return {
    state: { transactions: remaining, coins },
    removedIds: removed.map((t) => t.id),
  }
}

/** Valida la línea temporal de todas las monedas (lanza con el mensaje de la primera inválida) */
export const validateCryptoTimelines = ({ transactions, coins }: CryptoPortfolioState) => {
  for (const coinId of new Set(transactions.map((t) => t.coinId))) {
    assertCoinTimeline(
      transactions.filter((t) => t.coinId === coinId),
      coins[coinId],
      (symbol, date) => `No tenés suficiente ${symbol} para vender el ${date}.`,
    )
  }
}
