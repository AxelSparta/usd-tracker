import { create, type StateCreator } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  applyAddCryptoTransaction,
  applyAddSwap,
  applyRemoveCryptoTransaction,
  applyUpdateCryptoTransaction,
  type CryptoPortfolioState,
  type CryptoSwapInput,
} from './operations'
import { createSync, initialSyncFields, localData, type SyncFields } from '@/lib/synced-store'
import { cryptoApi } from './api'
import type { Coin, CryptoTransaction } from './types'

export type { CryptoSwapInput } from './operations'

interface CryptoState extends CryptoPortfolioState, SyncFields<CryptoPortfolioState> {
  /**
   * Validan con las funciones puras de `operations.ts` (rechazan con `Error` en español)
   * y, con sesión, confirman con la API (rechazan con su mensaje y revierten).
   */
  addTransaction: (tx: Omit<CryptoTransaction, 'id'>, coin: Coin) => Promise<void>
  updateTransaction: (
    transactionId: string,
    tx: Omit<CryptoTransaction, 'id'>,
    coin: Coin,
  ) => Promise<void>
  addSwap: (swap: CryptoSwapInput) => Promise<void>
  /** Si es una pata de un intercambio, borra también la otra */
  removeTransaction: (transactionId: string) => Promise<void>
  /**
   * Estado ya validado por otro módulo (`features/usdt-swaps`) que escribe en los dos stores
   * con una sola llamada a la API (`remote`, que se llama solo con sesión).
   */
  applyExternal: (next: CryptoPortfolioState, remote: () => Promise<unknown>) => Promise<void>
  /** Resuelve cuando ya se sabe el origen de datos y están cargados (ver `createSync`) */
  whenReady: () => Promise<void>

  connectCloud: () => Promise<void>
  disconnectCloud: () => void
  retryCloud: () => Promise<void>
  /** Recarga desde la nube sin mostrar `loading` */
  refreshCloud: () => Promise<void>
}

const EMPTY: CryptoPortfolioState = { transactions: [], coins: {} }

const pick = ({ transactions, coins }: CryptoPortfolioState): CryptoPortfolioState => ({
  transactions,
  coins,
})

const storeApi: StateCreator<CryptoState> = (set, get, api) => {
  const sync = createSync<CryptoPortfolioState, CryptoState>(set, get, {
    subscribe: api.subscribe,
    pick,
    empty: EMPTY,
    fetchCloud: cryptoApi.list,
  })

  return {
    ...EMPTY,
    ...initialSyncFields<CryptoPortfolioState>(),

    addTransaction: async (tx, coin) => {
      // `await` solo si hace falta: `await null` también cedería el turno
      const waiting = sync.untilReady()
      if (waiting) await waiting
      const newTransaction: CryptoTransaction = { id: crypto.randomUUID(), ...tx }
      const next = applyAddCryptoTransaction(get(), newTransaction, coin)
      await sync.commit(next, () => cryptoApi.create(newTransaction, coin))
    },

    updateTransaction: async (transactionId, tx, coin) => {
      const waiting = sync.untilReady()
      if (waiting) await waiting
      const next = applyUpdateCryptoTransaction(get(), transactionId, tx, coin)
      if (!next) return
      await sync.commit(next, () => cryptoApi.update(transactionId, tx, coin))
    },

    addSwap: async (swap) => {
      const waiting = sync.untilReady()
      if (waiting) await waiting
      const ids = {
        swapId: crypto.randomUUID(),
        sellId: crypto.randomUUID(),
        buyId: crypto.randomUUID(),
      }
      const next = applyAddSwap(get(), swap, ids)
      await sync.commit(next, () => cryptoApi.createSwap(swap, ids))
    },

    removeTransaction: async (transactionId) => {
      const waiting = sync.untilReady()
      if (waiting) await waiting
      const result = applyRemoveCryptoTransaction(get(), transactionId)
      if (!result) return
      await sync.commit(result.state, () => cryptoApi.remove(transactionId))
    },

    applyExternal: sync.commit,
    whenReady: sync.whenReady,

    connectCloud: sync.connectCloud,
    disconnectCloud: sync.disconnectCloud,
    retryCloud: sync.retry,
    refreshCloud: sync.refresh,
  }
}

type PersistedCryptoState = CryptoPortfolioState

/**
 * v1 → v2: se agregaron `fee` y `swapId`; v2 → v3: `usdtSwapId`; v3 → v4: `kind` y `note`.
 * Todos opcionales, así que
 * los datos viejos ya son válidos. Existe para que subir `version` no descarte lo guardado.
 */
export const migrateCryptoStorage = (
  persistedState: unknown,
): PersistedCryptoState => {
  const state = (persistedState ?? {}) as Partial<PersistedCryptoState>
  return { transactions: state.transactions ?? [], coins: state.coins ?? {} }
}

/** `partialize`: con sesión, los datos activos son de la nube; se persiste la copia local */
export const persistedCrypto = (state: CryptoState): CryptoPortfolioState =>
  localData(state, pick(state), EMPTY)

export const useCryptoStore = create<CryptoState>()(
  persist(storeApi, {
    name: 'crypto-storage',
    version: 4,
    partialize: persistedCrypto,
    migrate: migrateCryptoStorage,
  }),
)
