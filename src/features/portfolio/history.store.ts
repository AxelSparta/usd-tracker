import { create } from 'zustand'
import { requestJson } from '@/lib/http'
import type { CedearPricePoint, CoinPricePoint, DolarPricePoint } from './history'
import type { DolarOption } from '@/types/dolar.types'

/**
 * Precios históricos para el gráfico de evolución, cacheados durante la sesión (no se
 * persisten: cambian una vez por día y el server ya cachea). Clave = activos pedidos.
 */

export type PriceHistory = {
  dolar: Partial<Record<DolarOption, DolarPricePoint[]>>
  coins: Record<string, CoinPricePoint[]>
  cedears: Record<string, CedearPricePoint[]>
}

type Entry =
  | { status: 'loading' }
  | { status: 'ready'; data: PriceHistory }
  | { status: 'error'; message: string }

interface HistoryState {
  entries: Record<string, Entry>
  load: (casas: string[], ids: string[], tickers: string[], force?: boolean) => void
}

export const historyKey = (casas: string[], ids: string[], tickers: string[]) =>
  [casas, ids, tickers].map((values) => [...values].sort().join(',')).join('|')

export const useHistoryStore = create<HistoryState>()((set, get) => ({
  entries: {},
  load: (casas, ids, tickers, force = false) => {
    const key = historyKey(casas, ids, tickers)
    const current = get().entries[key]
    // Ya pedido (o en curso): solo se reintenta a pedido, tras un error
    if (current && !(force && current.status === 'error')) return

    set({ entries: { ...get().entries, [key]: { status: 'loading' } } })
    const query = (name: string, values: string[]) =>
      `${name}=${encodeURIComponent(values.join(','))}`

    Promise.all([
      requestJson<PriceHistory['dolar']>(`/api/history/dolar?${query('casas', casas)}`),
      requestJson<PriceHistory['coins']>(`/api/history/crypto?${query('ids', ids)}`),
      // Sin CEDEARs no se consulta data912
      tickers.length > 0
        ? requestJson<PriceHistory['cedears']>(`/api/history/cedears?${query('tickers', tickers)}`)
        : Promise.resolve({}),
    ])
      .then(([dolar, coins, cedears]) =>
        set({
          entries: { ...get().entries, [key]: { status: 'ready', data: { dolar, coins, cedears } } },
        }),
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
