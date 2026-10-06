import { create, type StateCreator } from 'zustand'
import { persist } from 'zustand/middleware'
import { createSync, initialSyncFields, localData, type SyncFields } from '@/lib/synced-store'
import { pesosApi } from './api'
import {
  applyAddPesosMovement,
  applyRemovePesosMovement,
  applyUpdatePesosMovement,
} from './operations'
import type { PesosMovement, PesosState } from './types'

interface PesosStoreState extends PesosState, SyncFields<PesosState> {
  /**
   * Validan con las funciones puras de `operations.ts` (rechazan con `Error` en español)
   * y, con sesión, confirman con la API (rechazan con su mensaje y revierten).
   */
  addMovement: (movement: Omit<PesosMovement, 'id'>) => Promise<void>
  updateMovement: (movementId: string, movement: Omit<PesosMovement, 'id'>) => Promise<void>
  removeMovement: (movementId: string) => Promise<void>
  /**
   * Estado ya validado por una operación que escribe en varios stores con una sola llamada
   * a la API (`remote`, que se llama solo con sesión): las conversiones (8.2).
   */
  applyExternal: (next: PesosState, remote: () => Promise<unknown>) => Promise<void>
  /** Resuelve cuando ya se sabe el origen de datos y están cargados (ver `createSync`) */
  whenReady: () => Promise<void>

  connectCloud: () => Promise<void>
  disconnectCloud: () => void
  retryCloud: () => Promise<void>
  /** Recarga desde la nube sin mostrar `loading` */
  refreshCloud: () => Promise<void>
}

const EMPTY: PesosState = { movements: [] }

const pick = ({ movements }: PesosState): PesosState => ({ movements })

const storeApi: StateCreator<PesosStoreState> = (set, get, api) => {
  const sync = createSync<PesosState, PesosStoreState>(set, get, {
    subscribe: api.subscribe,
    pick,
    empty: EMPTY,
    fetchCloud: pesosApi.list,
  })

  return {
    ...EMPTY,
    ...initialSyncFields<PesosState>(),

    addMovement: async (movement) => {
      // `await` solo si hace falta: `await null` también cedería el turno
      const waiting = sync.untilReady()
      if (waiting) await waiting
      const newMovement: PesosMovement = { id: crypto.randomUUID(), ...movement }
      const next = applyAddPesosMovement(get(), newMovement)
      await sync.commit(next, () => pesosApi.create(newMovement))
    },

    updateMovement: async (movementId, movement) => {
      const waiting = sync.untilReady()
      if (waiting) await waiting
      const next = applyUpdatePesosMovement(get(), movementId, movement)
      if (!next) return
      await sync.commit(next, () => pesosApi.update(movementId, movement))
    },

    removeMovement: async (movementId) => {
      const waiting = sync.untilReady()
      if (waiting) await waiting
      const next = applyRemovePesosMovement(get(), movementId)
      if (!next) return
      await sync.commit(next, () => pesosApi.remove(movementId))
    },

    applyExternal: sync.commit,
    whenReady: sync.whenReady,

    connectCloud: sync.connectCloud,
    disconnectCloud: sync.disconnectCloud,
    retryCloud: sync.retry,
    refreshCloud: sync.refresh,
  }
}

/** `partialize`: con sesión, los datos activos son de la nube; se persiste la copia local */
export const persistedPesos = (state: PesosStoreState): PesosState =>
  localData(state, pick(state), EMPTY)

export const usePesosStore = create<PesosStoreState>()(
  persist(storeApi, {
    name: 'pesos-storage',
    version: 1,
    partialize: persistedPesos,
  }),
)
