import { TransactionType } from '@/generated/prisma'
import type { Transaction, TransactionsData } from '@/types/transaction.types'
import { create, StateCreator } from 'zustand'
import { persist } from 'zustand/middleware'
import { useDolarStore } from './dolar.store'

interface State {
  transactions: Transaction[]
  transactionsData: TransactionsData

  isSignedIn: boolean
  
  getTransactions: () => Promise<void>
  addTransaction: (tx: Omit<Transaction, 'id'>) => Promise<void>
  sortTransactionsByDate: () => void
  removeTransaction: (id: string) => Promise<void>
  updateTransactionsData: (
    txs: Transaction[],
    dolarPriceOverride?: number
  ) => void
  
  setSignedIn: (signed: boolean) => void
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
      isSignedIn: false,
      setSignedIn: (signed: boolean) => set({ isSignedIn: signed }),

      getTransactions: async () => {
        if (get().isSignedIn) {
          // IMPLEMENTAR CON API
          // const res = await fetch('/api/transactions')
          // const data: Transaction[] = await res.json()
          // set({ transactions: data })
          // get().updateTransactionsData(data)
        } else {
          const localTxs = get().transactions
          get().updateTransactionsData(localTxs)
        }
      },
      addTransaction: async tx => {
        const newTransaction: Transaction = {
          id: crypto.randomUUID(),
          date: tx.date,
          pesos: tx.pesos,
          usd: tx.usd,
          usdPerPesos: tx.usdPerPesos,
          type: tx.type
        }

        if (get().isSignedIn) {
          // IMPLEMENTAR CON API
          // const res = await fetch('/api/transactions', {
          //   method: 'POST',
          //   headers: { 'Content-Type': 'application/json' },
          //   body: JSON.stringify(newTransaction)
          // })
          // const newTx: Transaction = await res.json()
          // const updated = [...get().transactions, newTx]
          // set({ transactions: updated })
          // get().updateTransactionsData(updated)
        } else {
          const updated = [...get().transactions, newTransaction]
          set({ transactions: updated })
          get().sortTransactionsByDate()
          get().updateTransactionsData(updated)
        }
      },
      removeTransaction: async id => {
        if (get().isSignedIn) {
          // IMPLEMENTAR CON API
          // await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
          // const updated = get().transactions.filter(tx => tx.id !== id)
          // set({ transactions: updated })
          // get().updateTransactionsData(updated)
        } else {
          const updated = get().transactions.filter(tx => tx.id !== id)
          set({ transactions: updated })
          get().sortTransactionsByDate()
          get().updateTransactionsData(updated)
        }
      },
      updateTransactionsData: txs => {
        // const totalPesos = txs.reduce((acc, tx) => acc + tx.pesos, 0)
        // const totalUsd = txs.reduce((acc, tx) => acc + tx.usd, 0)
        // const dolarPrice =
        //   dolarPriceOverride ?? useDolarStore.getState().dolarData?.venta ?? 0
        // const gananciaPerdida = totalUsd * dolarPrice - totalPesos
        // set({ transactionsData: { totalPesos, totalUsd, gananciaPerdida } })
        let totalUsd = 0
        let totalPesos = 0
        let averageCost = 0
        let realizedProfit = 0
        const dolarPrice = useDolarStore.getState().dolarData?.venta ?? 0

        for (const tx of txs) {
          const { type, usd, pesos } = tx

          if (type === TransactionType.BUY) {
            totalPesos += pesos
            totalUsd += usd
            averageCost = totalPesos / totalUsd
          }

          if (type === TransactionType.SELL) {
            const precioVenta = pesos / usd
            const ganancia = (precioVenta - averageCost) * usd
            
            realizedProfit += ganancia
            totalUsd -= usd
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
  persist(
    storeApi,
    {
      name: 'transactions-storage'
    }
  )
)

// 🔄 Suscripción: cuando cambie el dólar, recalcular transactionsData
useDolarStore.subscribe(state => {
  const txs = useTransactionStore.getState().transactions
  useTransactionStore
    .getState()
    .updateTransactionsData(txs, state.dolarData?.venta)
})
