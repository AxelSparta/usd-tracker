/**
 * Origen de datos de un store con `persist` que puede trabajar contra la nube.
 *
 * - `local`: los datos viven en `localStorage` (como siempre).
 * - `cloud`: con sesión, los datos activos vienen de la API. La copia local se guarda
 *   aparte (`localSnapshot`) y es lo único que se sigue persistiendo, así que no se
 *   pierde ni se mezcla con la nube; vuelve al cerrar sesión (Fase 3: subirla).
 *
 * Las escrituras son optimistas: el estado nuevo (ya validado con las funciones puras
 * del dominio) se aplica al instante y, en la nube, se confirma con la API. Si la API
 * falla, se revierte; si mientras tanto hubo otra escritura, se recarga desde la nube
 * (revertir pisaría la otra). El error se relanza para que la UI lo muestre.
 */

export type DataSource = 'local' | 'cloud'

/** `pending`: todavía no se sabe si hay sesión (Clerk cargando) */
export type SyncStatus = 'pending' | 'loading' | 'ready' | 'error'

export type SyncFields<D> = {
  source: DataSource
  status: SyncStatus
  /** Copia local mientras `source === 'cloud'` */
  localSnapshot: D | null
  /** Escrituras enviadas a la API que todavía no respondieron */
  pendingWrites: number
}

export const initialSyncFields = <D>(): SyncFields<D> => ({
  source: 'local',
  status: 'pending',
  localSnapshot: null,
  pendingWrites: 0,
})

export const createSync = <D extends object, S extends SyncFields<D> & D>(
  set: (partial: Partial<S>) => void,
  get: () => S,
  options: {
    /** Los datos del estado completo */
    pick: (state: S) => D
    empty: D
    fetchCloud: () => Promise<D>
    /** `api.subscribe` de Zustand (para `whenReady`) */
    subscribe: (listener: (state: S) => void) => () => void
  },
) => {
  const { pick, empty, fetchCloud, subscribe } = options
  // Invalida respuestas viejas (logout o cambio de usuario a mitad de un fetch)
  let generation = 0

  const reload = async (clear: boolean) => {
    const current = ++generation
    if (clear) set({ ...empty, status: 'loading' } as Partial<S>)
    try {
      const data = await fetchCloud()
      if (current === generation) set({ ...data, status: 'ready' } as Partial<S>)
    } catch {
      if (current === generation) set({ status: 'error' } as Partial<S>)
    }
  }

  // `pending`: todavía no se sabe si hay sesión; `loading`: los datos de la nube no llegaron
  const settling = () => ['pending', 'loading'].includes(get().status)

  return {
    /**
     * Espera a que se sepa el origen y estén sus datos. Las acciones lo llaman antes de validar:
     * si no, una escritura recién recargada la página iría a lo local aunque haya sesión, o se
     * validaría contra un estado vacío.
     */
    whenReady: () =>
      new Promise<void>((resolve) => {
        if (!settling()) return resolve()
        const unsubscribe = subscribe(() => {
          if (settling()) return
          unsubscribe()
          resolve()
        })
      }),

    /**
     * Para el comienzo de una acción: `null` si ya está listo (la acción sigue sin ceder el turno,
     * así el cambio optimista se ve en el acto); si no, la promesa de `whenReady`.
     */
    untilReady(): Promise<void> | null {
      return settling() ? this.whenReady() : null
    },

    /** Con sesión: guarda la copia local y carga los datos de la nube */
    connectCloud: () => {
      if (get().source !== 'cloud') {
        set({ source: 'cloud', localSnapshot: pick(get()) } as Partial<S>)
      }
      return reload(true)
    },

    /** Sin sesión: vuelve a la copia local */
    disconnectCloud: () => {
      generation++
      const { source, localSnapshot } = get()
      set({
        ...(source === 'cloud' ? (localSnapshot ?? empty) : {}),
        source: 'local',
        status: 'ready',
        localSnapshot: null,
        pendingWrites: 0,
      } as Partial<S>)
    },

    /** Reintenta la carga tras un error */
    retry: () => reload(true),

    /** Vuelve a pedir los datos sin pasar por `loading` (ej. después de importar) */
    refresh: () => (get().source === 'cloud' ? reload(false) : Promise.resolve()),

    commit: async (next: D, remote: () => Promise<unknown>) => {
      const previous = pick(get())
      set(next as Partial<S>)
      if (get().source !== 'cloud') return

      const started = generation
      // Sin mirar `generation`: una recarga en el medio no debe dejar el contador colgado
      // (al cerrar sesión se pone en 0 y el `max` evita negativos)
      const settle = () =>
        set({ pendingWrites: Math.max(0, get().pendingWrites - 1) } as Partial<S>)
      set({ pendingWrites: get().pendingWrites + 1 } as Partial<S>)
      try {
        await remote()
        settle()
      } catch (error) {
        settle()
        if (started === generation) {
          const current = pick(get())
          const untouched = (Object.keys(next) as (keyof D)[]).every(
            (key) => current[key] === next[key],
          )
          if (untouched) set(previous as Partial<S>)
          else void reload(false)
        }
        throw error
      }
    },
  }
}

/** Para `partialize`: lo que se persiste son siempre los datos locales */
export const localData = <D>(state: SyncFields<D>, current: D, empty: D): D =>
  state.source === 'cloud' ? (state.localSnapshot ?? empty) : current
