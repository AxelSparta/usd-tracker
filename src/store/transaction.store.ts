import { DolarOption } from '@/types/dolar.types'
import type {
  Transaction,
  TransactionsData,
  TransactionType
} from '@/types/transaction.types'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useDolarStore } from './dolar.store'

interface State {
  transactions: Transaction[]
  transactionsData: TransactionsData

  isSignedIn: boolean
  setSignedIn: (signed: boolean) => void

  getTransactions: () => Promise<void>
  addTransaction: (tx: Omit<Transaction, 'id'>) => Promise<void>
  removeTransaction: (id: string) => Promise<void>

  updateTransactionsData: (
    txs: Transaction[],
    dolarPriceOverride?: number
  ) => void
}

export const useTransactionStore = create<State>()(
  persist(
    (set, get) => ({
      transactions: [],
      transactionsData: { totalPesos: 0, totalUsd: 0, gananciaPerdida: 0 },
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
          get().updateTransactionsData(updated)
        }
      },
      updateTransactionsData: (txs, dolarPriceOverride) => {
        const totalPesos = txs.reduce((acc, tx) => acc + tx.pesos, 0)
        const totalUsd = txs.reduce((acc, tx) => acc + tx.usd, 0)
        const dolarPrice =
          dolarPriceOverride ?? useDolarStore.getState().dolarData?.venta ?? 0
        const gananciaPerdida = totalUsd * dolarPrice - totalPesos
        set({ transactionsData: { totalPesos, totalUsd, gananciaPerdida } })
      }
    }),
    {
      name: 'transactions-storage', // Key de localStorage
      skipHydration: true // Evita problemas en SSR
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
