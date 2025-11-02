import { TransactionType } from '@/generated/prisma'
import type { Transaction, TransactionsData } from '@/types/transaction.types'
import { useAuth } from '@clerk/nextjs'; // para saber si hay user en server
import { create, StateCreator } from 'zustand'
import { persist } from 'zustand/middleware'
import { useDolarStore } from './dolar.store'

interface State {
  transactions: Transaction[]
  transactionsData: TransactionsData

  getTransactions: ({ isSignedIn }: { isSignedIn: boolean }) => Promise<void>
  addTransaction: ({
    tx,
    isSignedIn
  }: {
    tx: Omit<Transaction, 'id'>
    isSignedIn: boolean
  }) => Promise<void>
  sortTransactionsByDate: () => void
  removeTransaction: ({
    isSignedIn,
    transactionId
  }: {
    transactionId: string
    isSignedIn: boolean
  }) => Promise<void>
  updateTransactionsData: (txs: Transaction[]) => void
}

const storeApi: StateCreator<State> = (set, get) => ({
  transactions: [],
  transactionsData: {
    totalUsd: 0,
    totalPesos: 0,
    averageCost: 0,
    realizedProfit: 0,
    unrealizedProfit: 0
  },

  getTransactions: async ({ isSignedIn }) => {
    if (isSignedIn) {
      const res = await fetch('/api/transactions')
      if (!res.ok) return
      const data: Transaction[] = await res.json()
      set({ transactions: data })
      get().updateTransactionsData(data)
    } else {
      // local
      const localTxs = get().transactions
      get().updateTransactionsData(localTxs)
    }
  },

  addTransaction: async ({ tx, isSignedIn }) => {
    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      date: tx.date,
      dollarsAmount: tx.dollarsAmount,
      pesosAmount: tx.pesosAmount,
      usdPrice: tx.usdPrice,
      type: tx.type
    }

    if (isSignedIn) {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTransaction)
      })
      if (!res.ok) return
      const newTx: Transaction = await res.json()
      const updatedTransactions = [...get().transactions, newTx]
      set({ transactions: updatedTransactions })
      get().updateTransactionsData(updatedTransactions)
    } else {
      const updated = [...get().transactions, newTransaction]
      set({ transactions: updated })
      get().updateTransactionsData(updated)
    }
  },

  removeTransaction: async ({ transactionId, isSignedIn }) => {
    if (isSignedIn) {
      const res = await fetch(`/api/transactions/${transactionId}`, {
        method: 'DELETE'
      })
      if (!res.ok) return
      const updatedTransactions = get().transactions.filter(
        tx => tx.id !== transactionId
      )
      set({ transactions: updatedTransactions })
      get().updateTransactionsData(updatedTransactions)
    } else {
      const updated = get().transactions.filter(tx => tx.id !== transactionId)
      set({ transactions: updated })
      get().updateTransactionsData(updated)
    }
  },

  updateTransactionsData: txs => {
    let totalUsd = 0
    let totalPesos = 0
    let averageCost = 0
    let realizedProfit = 0
    const dolarPrice = useDolarStore.getState().dolarData?.venta ?? 0

    for (const tx of txs) {
      const { type, dollarsAmount, pesosAmount } = tx

      if (type === TransactionType.BUY) {
        totalPesos += pesosAmount
        totalUsd += dollarsAmount
        averageCost = totalPesos / totalUsd
      }

      if (type === TransactionType.SELL) {
        const precioVenta = pesosAmount / dollarsAmount
        const ganancia = (precioVenta - averageCost) * dollarsAmount

        realizedProfit += ganancia
        totalUsd -= dollarsAmount
      }
    }

    const unrealizedProfit = (dolarPrice - averageCost) * totalUsd

    set({
      transactionsData: {
        totalUsd,
        totalPesos,
        averageCost,
        realizedProfit,
        unrealizedProfit
      }
    })
  },

  sortTransactionsByDate: () => {
    const sorted = [...get().transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    set({ transactions: sorted })
  }
})

export const useTransactionStore = create<State>()(
  persist(storeApi, {
    name: 'transactions-storage'
  })
)

// 🔄 Suscripción: cuando cambie el dólar, recalcular transactionsData
useDolarStore.subscribe(state => {
  if (!state.dolarData) {
    useTransactionStore.getState().updateTransactionsData([])
    return
  }
  const txs = useTransactionStore.getState().transactions
  useTransactionStore.getState().updateTransactionsData(txs)
})
