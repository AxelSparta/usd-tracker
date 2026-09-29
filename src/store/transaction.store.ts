import {
  TransactionType,
  type Transaction,
  type TransactionsDataMap,
} from '@/types/transaction.types'
import { DolarOption } from '@/types/dolar.types'
import { create, StateCreator } from 'zustand'
import { persist } from 'zustand/middleware'
import { selectMarketPrices, useDolarStore } from './dolar.store'
import { computeTransactionsData } from '@/domain/metrics'
import { sortTxs, validateTimeline } from '@/domain/timeline'

interface State {
  transactions: Partial<Record<DolarOption, Transaction[]>>
  transactionsData: TransactionsDataMap

  addTransaction: ({
    tx,
    isSignedIn,
  }: {
    tx: Omit<Transaction, 'id'>
    isSignedIn: boolean
  }) => Promise<void>
  removeTransaction: ({
    isSignedIn,
    transactionId,
  }: {
    transactionId: string
    isSignedIn: boolean
  }) => Promise<void>
  updateTransactionsData: (
    txs: Partial<Record<DolarOption, Transaction[]>>,
  ) => void
}

const storeApi: StateCreator<State> = (set, get) => ({
  transactions: {},
  transactionsData: {},

  addTransaction: async ({ tx, isSignedIn }) => {
    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      ...tx,
    }
    const currentGroup = get().transactions[tx.dolarOption] || []
    const newGroup = sortTxs([...currentGroup, newTransaction])

    if (tx.type === TransactionType.SELL) {
      validateTimeline(newGroup)
    }

    if (isSignedIn) {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTransaction),
      })
      if (!res.ok) return
      const newTx: Transaction = await res.json()

      const currentTxs = get().transactions[newTx.dolarOption] || []
      const updatedTransactions = {
        ...get().transactions,
        [newTx.dolarOption]: sortTxs([...currentTxs, newTx]),
      }
      set({ transactions: updatedTransactions })
      get().updateTransactionsData(updatedTransactions)
    } else {
      const updated = {
        ...get().transactions,
        [newTransaction.dolarOption]: newGroup,
      }
      set({ transactions: updated })
      get().updateTransactionsData(updated)
    }
  },

  removeTransaction: async ({ transactionId, isSignedIn }) => {
    let foundOption: DolarOption | null = null
    const allTxs = get().transactions

    for (const option in allTxs) {
      if (
        allTxs[option as DolarOption]?.find((tx) => tx.id === transactionId)
      ) {
        foundOption = option as DolarOption
        break
      }
    }

    if (!foundOption) return

    if (isSignedIn) {
      const res = await fetch(`/api/transactions/${transactionId}`, {
        method: 'DELETE',
      })
      if (!res.ok) return

      const currentTxs = get().transactions[foundOption] || []
      const updatedGroup = currentTxs.filter((tx) => tx.id !== transactionId)
      const updatedTransactions = {
        ...get().transactions,
        [foundOption]: updatedGroup,
      }
      set({ transactions: updatedTransactions })
      get().updateTransactionsData(updatedTransactions)
    } else {
      const currentTxs = get().transactions[foundOption] || []
      const updatedGroup = currentTxs.filter((tx) => tx.id !== transactionId)
      const sortedGroup = sortTxs(updatedGroup)

      validateTimeline(sortedGroup)

      const updatedTransactions = {
        ...get().transactions,
        [foundOption]: sortedGroup,
      }
      set({ transactions: updatedTransactions })
      get().updateTransactionsData(updatedTransactions)
    }
  },

  updateTransactionsData: (groupedTxs) => {
    const prices = selectMarketPrices(useDolarStore.getState())
    set({ transactionsData: computeTransactionsData(groupedTxs, prices) })
  },
})

export const useTransactionStore = create<State>()(
  persist(storeApi, {
    name: 'transactions-storage',
  }),
)

useDolarStore.subscribe(() => {
  const txs = useTransactionStore.getState().transactions
  useTransactionStore.getState().updateTransactionsData(txs)
})
