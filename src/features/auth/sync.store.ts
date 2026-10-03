import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Ids de operaciones locales que ya se le ofreció subir a cada usuario (las subió o
 * eligió "Ahora no"), para no volver a preguntar por las mismas en cada carga.
 * Igual se pueden subir a mano desde el indicador de sincronización.
 */
interface SyncState {
  handledIds: Record<string, string[]>
  markHandled: (userId: string, ids: string[]) => void
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      handledIds: {},
      markHandled: (userId, ids) => {
        const current = get().handledIds[userId] ?? []
        set({
          handledIds: {
            ...get().handledIds,
            [userId]: [...new Set([...current, ...ids])],
          },
        })
      },
    }),
    {
      name: 'sync-storage',
      version: 1,
      partialize: ({ handledIds }) => ({ handledIds }),
    },
  ),
)
