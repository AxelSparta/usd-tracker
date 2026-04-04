import { TransactionType, type Transaction, type TransactionsDataMap } from '@/types/transaction.types'
import { DolarOption } from '@/types/dolar.types'
import { create, StateCreator } from 'zustand'
import { persist } from 'zustand/middleware'
import { useDolarStore } from './dolar.store'

interface State {
  transactions: Partial<Record<DolarOption, Transaction[]>>
  transactionsData: TransactionsDataMap

  getTransactions: ({ isSignedIn }: { isSignedIn: boolean }) => Promise<void>
  addTransaction: ({
    tx,
    isSignedIn
  }: {
    tx: Omit<Transaction, 'id'>
    isSignedIn: boolean
  }) => Promise<void>
  removeTransaction: ({
    isSignedIn,
    transactionId
  }: {
    transactionId: string
    isSignedIn: boolean
  }) => Promise<void>
  updateTransactionsData: (txs: Partial<Record<DolarOption, Transaction[]>>) => void
}

/** Utility to sort transactions by date (ascending) */
const sortTxs = (txs: Transaction[]) => 
  [...txs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

const storeApi: StateCreator<State> = (set, get) => ({
  transactions: {},
  transactionsData: {},

  getTransactions: async ({ isSignedIn }) => {
    if (isSignedIn) {
      const res = await fetch('/api/transactions')
      if (!res.ok) return
      const data: Transaction[] = await res.json()
      
      const grouped = data.reduce((acc, tx) => {
        if (!acc[tx.dolarOption]) acc[tx.dolarOption] = []
        acc[tx.dolarOption]!.push(tx)
        return acc
      }, {} as Partial<Record<DolarOption, Transaction[]>>)

      // Sort each group
      for (const option in grouped) {
        grouped[option as DolarOption] = sortTxs(grouped[option as DolarOption]!)
      }

      set({ transactions: grouped })
      get().updateTransactionsData(grouped)
    } else {
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
      type: tx.type,
      dolarOption: tx.dolarOption
    }

    if (tx.type === TransactionType.SELL) {
      const currentGroup = get().transactions[tx.dolarOption] || []
      const balanceAtDate = currentGroup
        .filter(t => new Date(t.date) <= new Date(tx.date))
        .reduce((acc, t) => {
          return t.type === TransactionType.BUY ? acc + t.dollarsAmount : acc - t.dollarsAmount
        }, 0)

      if (tx.dollarsAmount > balanceAtDate) {
        throw new Error(`No tienes suficientes dólares (${tx.dolarOption}) para vender en esa fecha. Balance disponible: ${balanceAtDate}`)
      }
    }

    if (isSignedIn) {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTransaction)
      })
      if (!res.ok) return
      const newTx: Transaction = await res.json()
      
      const currentTxs = get().transactions[newTx.dolarOption] || []
      const updatedTransactions = {
        ...get().transactions,
        [newTx.dolarOption]: sortTxs([...currentTxs, newTx])
      }
      set({ transactions: updatedTransactions })
      get().updateTransactionsData(updatedTransactions)
    } else {
      const currentTxs = get().transactions[newTransaction.dolarOption] || []
      const updated = {
        ...get().transactions,
        [newTransaction.dolarOption]: sortTxs([...currentTxs, newTransaction])
      }
      set({ transactions: updated })
      get().updateTransactionsData(updated)
    }
  },

  removeTransaction: async ({ transactionId, isSignedIn }) => {
    let foundOption: DolarOption | null = null
    const allTxs = get().transactions
    
    for (const option in allTxs) {
      if (allTxs[option as DolarOption]?.find(tx => tx.id === transactionId)) {
        foundOption = option as DolarOption
        break
      }
    }

    if (!foundOption) return

    if (isSignedIn) {
      const res = await fetch(`/api/transactions/${transactionId}`, {
        method: 'DELETE'
      })
      if (!res.ok) return
      
      const currentTxs = get().transactions[foundOption] || []
      const updatedGroup = currentTxs.filter(tx => tx.id !== transactionId)
      const updatedTransactions = {
        ...get().transactions,
        [foundOption]: updatedGroup
      }
      set({ transactions: updatedTransactions })
      get().updateTransactionsData(updatedTransactions)
    } else {
      const currentTxs = get().transactions[foundOption] || []
      const updatedGroup = currentTxs.filter(tx => tx.id !== transactionId)
      const updatedTransactions = {
        ...get().transactions,
        [foundOption]: updatedGroup
      }
      set({ transactions: updatedTransactions })
      get().updateTransactionsData(updatedTransactions)
    }
  },

  updateTransactionsData: groupedTxs => {
    const newDataMap: TransactionsDataMap = {}
    const currentDolarData = useDolarStore.getState().dolarData
    const currentDolarOption = useDolarStore.getState().dolarOption

    for (const option in groupedTxs) {
      const dolarOption = option as DolarOption
      const txs = groupedTxs[dolarOption] || []

      let totalUsd = 0
      let totalPesos = 0
      let averageCost = 0
      let realizedProfit = 0

      for (const tx of txs) {
        const { type, dollarsAmount, pesosAmount } = tx

        if (type === TransactionType.BUY) {
          totalPesos += pesosAmount
          totalUsd += dollarsAmount
          averageCost = totalUsd > 0 ? totalPesos / totalUsd : 0
        }

        if (type === TransactionType.SELL) {
          const precioVenta = pesosAmount / dollarsAmount
          const ganancia = (precioVenta - averageCost) * dollarsAmount

          realizedProfit += ganancia
          totalUsd -= dollarsAmount
          totalPesos = totalUsd * averageCost
        }
      }

      let unrealizedProfit = 0
      if (currentDolarOption === dolarOption && currentDolarData) {
        unrealizedProfit = (currentDolarData.venta - averageCost) * totalUsd
      }

      newDataMap[dolarOption] = {
        totalUsd,
        totalPesos,
        averageCost,
        realizedProfit,
        unrealizedProfit
      }
    }

    set({ transactionsData: newDataMap })
  }
})

export const useTransactionStore = create<State>()(
  persist(storeApi, {
    name: 'transactions-storage'
  })
)

useDolarStore.subscribe(state => {
  const txs = useTransactionStore.getState().transactions
  useTransactionStore.getState().updateTransactionsData(txs)
})
