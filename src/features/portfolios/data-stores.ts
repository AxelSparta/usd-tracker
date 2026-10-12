import type { StoreApi, UseBoundStore } from 'zustand'
import type { PersistOptions } from 'zustand/middleware'
import { useCedearsStore } from '@/features/cedears/cedears.store'
import type { CedearTransaction } from '@/features/cedears/types'
import { useCryptoStore } from '@/features/crypto/crypto.store'
import type { CryptoPortfolioState } from '@/features/crypto/operations'
import { usePesosStore } from '@/features/pesos/pesos.store'
import type { PesosMovement } from '@/features/pesos/types'
import { useTransactionStore } from '@/store/transaction.store'
import type { Transaction } from '@/types/transaction.types'

/**
 * Los cuatro stores de datos: siempre tienen **un** portafolio, el activo. Cambiar de portafolio
 * los recarga desde la nube o, en local, los apunta a otra clave de `localStorage`.
 */

/** El portafolio local que ya existía antes de los portafolios: usa las claves de siempre */
export const LOCAL_DEFAULT_PORTFOLIO_ID = 'principal'

/** Clave de `localStorage` de un store para un portafolio local */
export const localStorageName = (base: string, portfolioId: string) =>
  portfolioId === LOCAL_DEFAULT_PORTFOLIO_ID ? base : `${base}:${portfolioId}`

/** Datos de un portafolio (los de los cuatro módulos, sin agrupar) */
export type PortfolioData = {
  dolar: Transaction[]
  crypto: CryptoPortfolioState
  pesos: PesosMovement[]
  cedears: CedearTransaction[]
}

export const EMPTY_PORTFOLIO_DATA: PortfolioData = {
  dolar: [],
  crypto: { transactions: [], coins: {} },
  pesos: [],
  cedears: [],
}

type PersistedStore = UseBoundStore<StoreApi<object>> & {
  /** `undefined` sin `localStorage` (server) */
  persist?: {
    setOptions: (options: Partial<PersistOptions<object, unknown>>) => void
    getOptions: () => Partial<PersistOptions<object, unknown>>
    rehydrate: () => Promise<void> | void
  }
}

type DataStore = {
  store: PersistedStore
  /** Nombre de `persist` del portafolio local por defecto */
  base: string
  empty: object
}

const dataStore = (store: unknown, base: string, empty: object): DataStore => ({
  store: store as PersistedStore,
  base,
  empty,
})

export const DATA_STORES = [
  dataStore(useTransactionStore, 'transactions-storage', { transactions: {} }),
  dataStore(useCryptoStore, 'crypto-storage', { transactions: [], coins: {} }),
  dataStore(usePesosStore, 'pesos-storage', { movements: [] }),
  dataStore(useCedearsStore, 'cedears-storage', { transactions: [] }),
]

/**
 * Apunta los stores a las claves del portafolio local `portfolioId` y carga lo que tengan. Solo en
 * modo local: con sesión, lo que se persiste es la copia local (`localSnapshot`) del portafolio local
 * activo y su clave no debe cambiar.
 */
export const switchLocalPortfolio = async (portfolioId: string) => {
  for (const { store, base, empty } of DATA_STORES) {
    const name = localStorageName(base, portfolioId)
    if (!store.persist || store.persist.getOptions().name === name) continue
    store.persist.setOptions({ name })
    // Sin datos guardados `rehydrate` conservaría los del portafolio anterior: se vacía (y se guarda
    // vacío en la clave nueva)
    if (localStorage.getItem(name) === null) store.setState(empty)
    else await store.persist.rehydrate()
  }
}

/** Borra las claves de un portafolio local (no el activo: primero hay que cambiar a otro) */
export const clearLocalPortfolio = (portfolioId: string) => {
  for (const { base } of DATA_STORES) localStorage.removeItem(localStorageName(base, portfolioId))
}

/**
 * Lee de `localStorage` los datos de un portafolio local que no es el activo, migrándolos si
 * quedaron en una versión vieja (con el mismo `migrate` de cada store).
 */
export const readLocalPortfolio = (portfolioId: string): PortfolioData => {
  const [dolar, crypto, pesos, cedears] = DATA_STORES.map(({ store, base, empty }) => {
    const raw = localStorage.getItem(localStorageName(base, portfolioId))
    if (!raw) return empty
    try {
      const { state, version } = JSON.parse(raw) as { state: unknown; version?: number }
      const options = store.persist?.getOptions() ?? {}
      return (
        version !== undefined && version !== options.version && options.migrate
          ? options.migrate(state, version)
          : state
      ) as object
    } catch {
      return empty
    }
  }) as [
    { transactions: Partial<Record<string, Transaction[]>> },
    CryptoPortfolioState,
    { movements: PesosMovement[] },
    { transactions: CedearTransaction[] },
  ]
  return {
    dolar: Object.values(dolar.transactions ?? {}).flatMap((group) => group ?? []),
    crypto: { transactions: crypto.transactions ?? [], coins: crypto.coins ?? {} },
    pesos: pesos.movements ?? [],
    cedears: cedears.transactions ?? [],
  }
}

/** Los datos del portafolio activo, tal como están en los stores */
export const readActiveStores = (): PortfolioData => ({
  dolar: Object.values(useTransactionStore.getState().transactions).flatMap((g) => g ?? []),
  crypto: {
    transactions: useCryptoStore.getState().transactions,
    coins: useCryptoStore.getState().coins,
  },
  pesos: usePesosStore.getState().movements,
  cedears: useCedearsStore.getState().transactions,
})

/** Con sesión: recarga los stores desde la nube (con el portafolio que diga `PORTFOLIO_HEADER`) */
export const reloadCloudStores = () =>
  Promise.all([
    useTransactionStore.getState().connectCloud(),
    useCryptoStore.getState().connectCloud(),
    usePesosStore.getState().connectCloud(),
    useCedearsStore.getState().connectCloud(),
  ])
