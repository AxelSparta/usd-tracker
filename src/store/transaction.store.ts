import {
  TransactionType,
  type Transaction,
  type TransactionsDataMap,
} from '@/types/transaction.types'
import { DolarOption } from '@/types/dolar.types'
import { create, StateCreator } from 'zustand'
import { persist } from 'zustand/middleware'
import { useDolarStore } from './dolar.store'

const validateTimeline = (txs: Transaction[]) => {
  let balance = 0

  for (const tx of txs) {
    if (tx.type === TransactionType.BUY) {
      balance += tx.dollarsAmount
    } else {
      balance -= tx.dollarsAmount
    }

    if (balance < 0) {
      throw new Error(`Balance negativo detectado en fecha ${tx.date}`)
    }
  }
}

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

/** Sort by date ascending; same-day ties: BUY before SELL */
const sortTxs = (txs: Transaction[]) =>
  [...txs].sort((a, b) => {
    const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime()
    if (dateDiff !== 0) return dateDiff
    if (a.type === b.type) return 0
    return a.type === TransactionType.BUY ? -1 : 1
  })

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
    const newDataMap: TransactionsDataMap = {}
    const allDolarData = useDolarStore.getState().allDolarData

    const allOptions = Object.keys(groupedTxs) as DolarOption[]

    for (const dolarOption of allOptions) {
      const txs = groupedTxs[dolarOption] || []

      if (txs.length === 0) continue

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
          const precioVentaUnitario = dollarsAmount > 0 ? pesosAmount / dollarsAmount : 0
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

      const currentDolar = allDolarData?.[dolarOption]
      if (currentDolar && totalUsd > 0) {
        const ventaPrice = Number(currentDolar.venta) || 0
        marketValuePesos = totalUsd * ventaPrice
        unrealizedProfit = marketValuePesos - (totalUsd * averageCost)
      } else if (totalUsd === 0) {
        marketValuePesos = 0
        unrealizedProfit = 0
      }

      newDataMap[dolarOption] = {
        totalUsd: Number(totalUsd.toFixed(4)),
        investedPesos: Number(totalPesosCosto.toFixed(2)),
        marketValuePesos: Number(marketValuePesos.toFixed(2)),
        averageCost: Number(averageCost.toFixed(2)),
        realizedProfit: Number(realizedProfit.toFixed(2)),
        unrealizedProfit: Number(unrealizedProfit.toFixed(2)),
      }
    }

    set({ transactionsData: newDataMap })
  },
})

export const useTransactionStore = create<State>()(
  persist(storeApi, {
    name: 'transactions-storage',
  }),
)

useDolarStore.subscribe((state) => {
  const txs = useTransactionStore.getState().transactions
  useTransactionStore.getState().updateTransactionsData(txs)
})
