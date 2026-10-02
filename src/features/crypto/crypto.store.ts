import { format } from 'date-fns'
import { create, type StateCreator } from 'zustand'
import { persist } from 'zustand/middleware'
import { findNegativeBalance, sortTxs } from '@/domain/timeline'
import { TransactionType } from '@/types/transaction.types'
import { toPositionLot } from './metrics'
import type { Coin, CryptoTransaction } from './types'

/** Intercambio cripto ↔ cripto: se guarda como una venta y una compra enlazadas */
export type CryptoSwapInput = {
  from: Coin
  fromQuantity: number
  to: Coin
  toQuantity: number
  /** Valor del intercambio en USD: define el precio de venta y el costo de la compra */
  valueUsd: number
  date: Date
}

interface CryptoState {
  /** Lista plana; la agrupación por moneda se deriva (`groupByCoin`) */
  transactions: CryptoTransaction[]
  /** Metadatos de cada moneda usada, para no depender de CoinGecko al mostrarla */
  coins: Record<string, Coin>

  addTransaction: (tx: Omit<CryptoTransaction, 'id'>, coin: Coin) => void
  updateTransaction: (
    transactionId: string,
    tx: Omit<CryptoTransaction, 'id'>,
    coin: Coin,
  ) => void
  addSwap: (swap: CryptoSwapInput) => void
  /** Si es una pata de un intercambio, borra también la otra */
  removeTransaction: (transactionId: string) => void
}

const formatDate = (date: Date | string) => format(new Date(date), 'dd/MM/yyyy')

/** Lanza si alguna venta de la moneda supera el saldo disponible a esa fecha */
const assertCoinTimeline = (
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

const storeApi: StateCreator<CryptoState> = (set, get) => ({
  transactions: [],
  coins: {},

  addTransaction: (tx, coin) => {
    const newTransaction: CryptoTransaction = { id: crypto.randomUUID(), ...tx }
    const { transactions, coins } = get()

    assertCoinTimeline(
      [...transactions.filter((t) => t.coinId === tx.coinId), newTransaction],
      coin,
      (symbol, date) =>
        `No tenés suficiente ${symbol} para vender el ${date}.`,
    )

    set({
      transactions: [...transactions, newTransaction],
      coins: { ...coins, [coin.id]: coin },
    })
  },

  updateTransaction: (transactionId, tx, coin) => {
    const { transactions, coins } = get()
    const previous = transactions.find((t) => t.id === transactionId)
    if (!previous) return
    if (previous.swapId) {
      throw new Error('Los intercambios no se editan: borralo y cargalo de nuevo.')
    }

    const updated = transactions.map((t) =>
      t.id === transactionId ? { id: transactionId, ...tx } : t,
    )

    assertCoinTimeline(
      updated.filter((t) => t.coinId === tx.coinId),
      coin,
      (symbol, date) =>
        `No tenés suficiente ${symbol} para la venta del ${date}.`,
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

    set({ transactions: updated, coins: { ...coins, [coin.id]: coin } })
  },

  addSwap: ({ from, fromQuantity, to, toQuantity, valueUsd, date }) => {
    if (from.id === to.id) {
      throw new Error('Elegí dos monedas distintas para el intercambio.')
    }
    const swapId = crypto.randomUUID()
    const sellLeg: CryptoTransaction = {
      id: crypto.randomUUID(),
      coinId: from.id,
      type: TransactionType.SELL,
      quantity: fromQuantity,
      priceUsd: valueUsd / fromQuantity,
      date,
      swapId,
    }
    const buyLeg: CryptoTransaction = {
      id: crypto.randomUUID(),
      coinId: to.id,
      type: TransactionType.BUY,
      quantity: toQuantity,
      priceUsd: valueUsd / toQuantity,
      date,
      swapId,
    }
    const { transactions, coins } = get()

    assertCoinTimeline(
      [...transactions.filter((t) => t.coinId === from.id), sellLeg],
      from,
      (symbol, day) => `No tenés suficiente ${symbol} para intercambiar el ${day}.`,
    )

    set({
      transactions: [...transactions, sellLeg, buyLeg],
      coins: { ...coins, [from.id]: from, [to.id]: to },
    })
  },

  removeTransaction: (transactionId) => {
    const { transactions, coins } = get()
    const target = transactions.find((t) => t.id === transactionId)
    if (!target) return

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

    set({ transactions: remaining })
  },
})

type PersistedCryptoState = Pick<CryptoState, 'transactions' | 'coins'>

/**
 * v1 → v2: se agregaron `fee` y `swapId`, ambos opcionales, así que los datos v1
 * ya son válidos. Existe para que subir `version` no descarte lo guardado.
 */
export const migrateCryptoStorage = (
  persistedState: unknown,
): PersistedCryptoState => {
  const state = (persistedState ?? {}) as Partial<PersistedCryptoState>
  return { transactions: state.transactions ?? [], coins: state.coins ?? {} }
}

export const useCryptoStore = create<CryptoState>()(
  persist(storeApi, {
    name: 'crypto-storage',
    version: 2,
    partialize: ({ transactions, coins }) => ({ transactions, coins }),
    migrate: migrateCryptoStorage,
  }),
)
