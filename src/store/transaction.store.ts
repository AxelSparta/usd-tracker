import { useMemo } from 'react'
import type {
  Transaction,
  TransactionsDataMap,
} from '@/types/transaction.types'
import { DolarOption } from '@/types/dolar.types'
import { create, StateCreator } from 'zustand'
import { persist } from 'zustand/middleware'
import { selectMarketPrices, useDolarStore } from './dolar.store'
import { computeTransactionsData } from '@/domain/metrics'
import { sortTxs, validateTimeline } from '@/domain/timeline'

type GroupedTransactions = Partial<Record<DolarOption, Transaction[]>>

interface State {
  transactions: GroupedTransactions

  addTransaction: ({
    tx,
    isSignedIn,
  }: {
    tx: Omit<Transaction, 'id'>
    isSignedIn: boolean
  }) => Promise<void>
  /** Solo local: la rama remota se reconstruye en las Fases 2–3 */
  updateTransaction: (transactionId: string, tx: Omit<Transaction, 'id'>) => void
  removeTransaction: ({
    isSignedIn,
    transactionId,
  }: {
    transactionId: string
    isSignedIn: boolean
  }) => Promise<void>
}

const findGroup = (
  transactions: GroupedTransactions,
  transactionId: string,
): DolarOption | null => {
  for (const option in transactions) {
    if (transactions[option as DolarOption]?.some((tx) => tx.id === transactionId)) {
      return option as DolarOption
    }
  }
  return null
}

const storeApi: StateCreator<State> = (set, get) => ({
  transactions: {},

  addTransaction: async ({ tx, isSignedIn }) => {
    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      ...tx,
    }
    const currentGroup = get().transactions[tx.dolarOption] || []
    const newGroup = sortTxs([...currentGroup, newTransaction])

    validateTimeline(newGroup)

    if (isSignedIn) {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTransaction),
      })
      if (!res.ok) return
      const newTx: Transaction = await res.json()

      const currentTxs = get().transactions[newTx.dolarOption] || []
      set({
        transactions: {
          ...get().transactions,
          [newTx.dolarOption]: sortTxs([...currentTxs, newTx]),
        },
      })
    } else {
      set({
        transactions: {
          ...get().transactions,
          [newTransaction.dolarOption]: newGroup,
        },
      })
    }
  },

  updateTransaction: (transactionId, tx) => {
    const transactions = get().transactions
    const previousOption = findGroup(transactions, transactionId)
    if (!previousOption) return

    const updated: GroupedTransactions = {
      ...transactions,
      [previousOption]: (transactions[previousOption] || []).filter(
        (t) => t.id !== transactionId,
      ),
    }
    updated[tx.dolarOption] = sortTxs([
      ...(updated[tx.dolarOption] || []),
      { id: transactionId, ...tx },
    ])

    // Si cambió el tipo de dólar, el grupo de origen también pierde saldo
    validateTimeline(updated[tx.dolarOption]!)
    if (previousOption !== tx.dolarOption) {
      validateTimeline(updated[previousOption]!)
    }

    set({ transactions: updated })
  },

  removeTransaction: async ({ transactionId, isSignedIn }) => {
    const foundOption = findGroup(get().transactions, transactionId)
    if (!foundOption) return

    if (isSignedIn) {
      const res = await fetch(`/api/transactions/${transactionId}`, {
        method: 'DELETE',
      })
      if (!res.ok) return

      const currentTxs = get().transactions[foundOption] || []
      set({
        transactions: {
          ...get().transactions,
          [foundOption]: currentTxs.filter((tx) => tx.id !== transactionId),
        },
      })
    } else {
      const currentTxs = get().transactions[foundOption] || []
      const sortedGroup = sortTxs(
        currentTxs.filter((tx) => tx.id !== transactionId),
      )

      validateTimeline(sortedGroup)

      set({
        transactions: {
          ...get().transactions,
          [foundOption]: sortedGroup,
        },
      })
    }
  },
})

/**
 * v0 → v1: se deja de persistir `transactionsData` (ahora se deriva con
 * `useTransactionsData`). `transactions` no cambia de forma.
 */
export const migrateTransactionsStorage = (
  persistedState: unknown,
  version: number,
): Pick<State, 'transactions'> => {
  const state = (persistedState ?? {}) as Partial<State>
  if (version === 0) {
    return { transactions: state.transactions ?? {} }
  }
  return state as Pick<State, 'transactions'>
}

export const useTransactionStore = create<State>()(
  persist(storeApi, {
    name: 'transactions-storage',
    version: 1,
    partialize: ({ transactions }) => ({ transactions }),
    migrate: migrateTransactionsStorage,
  }),
)

/** Métricas por tipo de dólar, derivadas de transacciones + cotizaciones (no se persisten). */
export const useTransactionsData = (): TransactionsDataMap => {
  const transactions = useTransactionStore((state) => state.transactions)
  const allDolarData = useDolarStore((state) => state.allDolarData)

  return useMemo(
    () =>
      computeTransactionsData(
        transactions,
        selectMarketPrices({ allDolarData }),
      ),
    [transactions, allDolarData],
  )
}
