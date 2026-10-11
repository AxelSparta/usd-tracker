import { create, type StateCreator } from 'zustand'
import { persist } from 'zustand/middleware'
import { createSync, initialSyncFields, localData, type SyncFields } from '@/lib/synced-store'
import { cedearsApi } from './api'
import type { CedearState } from './types'

/**
 * Operaciones de CEDEARs (Fase 9.3). Toda escritura toca además Pesos o el Dólar CCL (su pata),
 * así que el alta, la edición y el borrado viven en `actions.ts` y llegan acá por `applyExternal`.
 */
interface CedearsStoreState extends CedearState, SyncFields<CedearState> {
  /** Estado ya validado por `actions.ts`; `remote` (la API) se llama solo con sesión */
  applyExternal: (next: CedearState, remote: () => Promise<unknown>) => Promise<void>
  /** Resuelve cuando ya se sabe el origen de datos y están cargados (ver `createSync`) */
  whenReady: () => Promise<void>

  connectCloud: () => Promise<void>
  disconnectCloud: () => void
  retryCloud: () => Promise<void>
  /** Recarga desde la nube sin mostrar `loading` */
  refreshCloud: () => Promise<void>
}

const EMPTY: CedearState = { transactions: [] }

const pick = ({ transactions }: CedearState): CedearState => ({ transactions })

const storeApi: StateCreator<CedearsStoreState> = (set, get, api) => {
  const sync = createSync<CedearState, CedearsStoreState>(set, get, {
    subscribe: api.subscribe,
    pick,
    empty: EMPTY,
    fetchCloud: cedearsApi.list,
  })

  return {
    ...EMPTY,
    ...initialSyncFields<CedearState>(),

    applyExternal: sync.commit,
    whenReady: sync.whenReady,

    connectCloud: sync.connectCloud,
    disconnectCloud: sync.disconnectCloud,
    retryCloud: sync.retry,
    refreshCloud: sync.refresh,
  }
}

/** `partialize`: con sesión, los datos activos son de la nube; se persiste la copia local */
export const persistedCedears = (state: CedearsStoreState): CedearState =>
  localData(state, pick(state), EMPTY)

export const useCedearsStore = create<CedearsStoreState>()(
  persist(storeApi, {
    name: 'cedears-storage',
    version: 1,
    partialize: persistedCedears,
  }),
)
