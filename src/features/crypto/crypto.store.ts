import { format } from 'date-fns'
import { create, type StateCreator } from 'zustand'
import { persist } from 'zustand/middleware'
import { findNegativeBalance, sortTxs } from '@/domain/timeline'
import type { Coin, CryptoTransaction } from './types'

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
  removeTransaction: (transactionId: string) => void
}

const formatDate = (date: Date | string) => format(new Date(date), 'dd/MM/yyyy')

/** Lanza si alguna venta de la moneda supera el saldo disponible a esa fecha */
const assertCoinTimeline = (
  txs: CryptoTransaction[],
  coin: Coin | undefined,
  message: (symbol: string, date: string) => string,
) => {
  const offending = findNegativeBalance(sortTxs(txs), (tx) => tx.quantity)
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

  removeTransaction: (transactionId) => {
    const { transactions, coins } = get()
    const target = transactions.find((t) => t.id === transactionId)
    if (!target) return

    const remaining = transactions.filter((t) => t.id !== transactionId)
    assertCoinTimeline(
      remaining.filter((t) => t.coinId === target.coinId),
      coins[target.coinId],
      (symbol, date) =>
        `No se puede eliminar: la venta de ${symbol} del ${date} quedaría sin saldo.`,
    )

    set({ transactions: remaining })
  },
})

export const useCryptoStore = create<CryptoState>()(
  persist(storeApi, {
    name: 'crypto-storage',
    version: 1,
    partialize: ({ transactions, coins }) => ({ transactions, coins }),
  }),
)
