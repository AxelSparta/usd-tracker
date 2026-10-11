import { format, isToday } from 'date-fns'
import { requestJson } from '@/lib/http'
import type { CedearIds, FundingLeg } from './operations'
import type {
  Cedear,
  CedearHistoryPoint,
  CedearPriceMap,
  CedearState,
  CedearTransaction,
} from './types'

/** Último precio ARS de cada ticker (`/api/cedears/prices`, proxy a data912) */
export const fetchCedearPrices = (tickers: string[]) =>
  requestJson<CedearPriceMap>(`/api/cedears/prices?tickers=${encodeURIComponent(tickers.join(','))}`)

export const fetchCedearSearch = (query: string, signal?: AbortSignal) =>
  requestJson<Cedear[]>(`/api/cedears/search?q=${encodeURIComponent(query)}`, { signal })

/**
 * Precio ARS de un CEDEAR en un día: el último si es hoy; si no, el cierre de ese día o del último
 * anterior. `null` si no hay dato (data912 no tiene histórico de muchos tickers): se carga a mano.
 */
export const fetchCedearPriceOn = async (ticker: string, day: Date): Promise<number | null> => {
  if (isToday(day)) return (await fetchCedearPrices([ticker]))[ticker]?.priceArs ?? null
  const history = await requestJson<Record<string, CedearHistoryPoint[]>>(
    `/api/history/cedears?tickers=${encodeURIComponent(ticker)}`,
  )
  const key = format(day, 'yyyy-MM-dd')
  let price: number | null = null
  for (const point of history[ticker] ?? []) {
    if (point.date > key) break
    price = point.ars
  }
  return price
}

// --- Operaciones del usuario en la nube (Fase 9.3): cada escritura incluye la pata ---

const TRANSACTIONS = '/api/cedears/transactions'

type Saved = { transaction: CedearTransaction; leg: FundingLeg }

export const cedearsApi = {
  list: () => requestJson<CedearState>(TRANSACTIONS),
  create: (input: Omit<CedearTransaction, 'id'>, ids: CedearIds) =>
    requestJson<Saved>(TRANSACTIONS, { method: 'POST', body: { ...input, ...ids } }),
  update: (id: string, input: Omit<CedearTransaction, 'id'>) =>
    requestJson<Saved>(`${TRANSACTIONS}/${id}`, { method: 'PATCH', body: input }),
  remove: (id: string) => requestJson<void>(`${TRANSACTIONS}/${id}`, { method: 'DELETE' }),
}
