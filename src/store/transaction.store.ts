import { useMemo } from 'react'
import type {
  Transaction,
  TransactionsDataMap,
} from '@/types/transaction.types'
import { create, StateCreator } from 'zustand'
import { persist } from 'zustand/middleware'
import { selectMarketPrices, useDolarStore } from './dolar.store'
import { computeTransactionsData } from '@/domain/metrics'
import {
  applyAddTransaction,
  applyRemoveTransaction,
  applyUpdateTransaction,
  groupTransactions,
  type GroupedTransactions,
} from '@/domain/transactions'
import {
  createSync,
  initialSyncFields,
  localData,
  type SyncFields,
} from '@/lib/synced-store'
import { dolarTransactionsApi } from '@/services/transactionsApi'

interface State extends SyncFields<DolarData> {
  transactions: GroupedTransactions

  /**
   * Validan con las funciones puras del dominio (rechazan con `Error` en español) y,
   * con sesión, confirman con la API (rechazan con su mensaje y revierten).
   */
  addTransaction: (tx: Omit<Transaction, 'id'>) => Promise<void>
  updateTransaction: (transactionId: string, tx: Omit<Transaction, 'id'>) => Promise<void>
  removeTransaction: (transactionId: string) => Promise<void>

  connectCloud: () => Promise<void>
  disconnectCloud: () => void
  retryCloud: () => Promise<void>
  /** Recarga desde la nube sin mostrar `loading` */
  refreshCloud: () => Promise<void>
}

type DolarData = { transactions: GroupedTransactions }

const EMPTY: DolarData = { transactions: {} }

const storeApi: StateCreator<State> = (set, get) => {
  const sync = createSync<DolarData, State>(set, get, {
    pick: ({ transactions }) => ({ transactions }),
    empty: EMPTY,
    fetchCloud: async () => ({
      transactions: groupTransactions(await dolarTransactionsApi.list()),
    }),
  })

  return {
    ...EMPTY,
    ...initialSyncFields<DolarData>(),

    addTransaction: async (tx) => {
      const newTransaction: Transaction = { id: crypto.randomUUID(), ...tx }
      const transactions = applyAddTransaction(get().transactions, newTransaction)
      await sync.commit({ transactions }, () =>
        dolarTransactionsApi.create(newTransaction),
      )
    },

    updateTransaction: async (transactionId, tx) => {
      const transactions = applyUpdateTransaction(get().transactions, transactionId, tx)
      if (!transactions) return
      await sync.commit({ transactions }, () =>
        dolarTransactionsApi.update(transactionId, tx),
      )
    },

    removeTransaction: async (transactionId) => {
      const transactions = applyRemoveTransaction(get().transactions, transactionId)
      if (!transactions) return
      await sync.commit({ transactions }, () =>
        dolarTransactionsApi.remove(transactionId),
      )
    },

    connectCloud: sync.connectCloud,
    disconnectCloud: sync.disconnectCloud,
    retryCloud: sync.retry,
    refreshCloud: sync.refresh,
  }
}

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

/** `partialize`: con sesión, `transactions` son de la nube; se persiste la copia local */
export const persistedTransactions = (state: State): DolarData =>
  localData(state, { transactions: state.transactions }, EMPTY)

export const useTransactionStore = create<State>()(
  persist(storeApi, {
    name: 'transactions-storage',
    version: 1,
    partialize: persistedTransactions,
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
