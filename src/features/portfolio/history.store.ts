import { create } from 'zustand'
import { requestJson } from '@/lib/http'
import type { CoinPricePoint, DolarPricePoint } from './history'
import type { DolarOption } from '@/types/dolar.types'

/**
 * Precios históricos para el gráfico de evolución, cacheados durante la sesión (no se
 * persisten: cambian una vez por día y el server ya cachea). Clave = activos pedidos.
 */

export type PriceHistory = {
  dolar: Partial<Record<DolarOption, DolarPricePoint[]>>
  coins: Record<string, CoinPricePoint[]>
}

type Entry =
  | { status: 'loading' }
  | { status: 'ready'; data: PriceHistory }
  | { status: 'error'; message: string }

interface HistoryState {
  entries: Record<string, Entry>
  load: (casas: string[], ids: string[], force?: boolean) => void
}

export const historyKey = (casas: string[], ids: string[]) =>
  `${[...casas].sort().join(',')}|${[...ids].sort().join(',')}`

export const useHistoryStore = create<HistoryState>()((set, get) => ({
  entries: {},
  load: (casas, ids, force = false) => {
    const key = historyKey(casas, ids)
    const current = get().entries[key]
    // Ya pedido (o en curso): solo se reintenta a pedido, tras un error
    if (current && !(force && current.status === 'error')) return

    set({ entries: { ...get().entries, [key]: { status: 'loading' } } })
    const query = (name: string, values: string[]) =>
      `${name}=${encodeURIComponent(values.join(','))}`

    Promise.all([
      requestJson<PriceHistory['dolar']>(`/api/history/dolar?${query('casas', casas)}`),
      requestJson<PriceHistory['coins']>(`/api/history/crypto?${query('ids', ids)}`),
    ])
      .then(([dolar, coins]) =>
        set({ entries: { ...get().entries, [key]: { status: 'ready', data: { dolar, coins } } } }),
      )
      .catch((error: unknown) =>
        set({
          entries: {
            ...get().entries,
            [key]: {
              status: 'error',
              message: error instanceof Error ? error.message : 'No se pudo cargar el histórico.',
            },
          },
        }),
      )
  },
}))
