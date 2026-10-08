import { requestJson } from '@/lib/http'
import type { CedearIds, FundingLeg } from './operations'
import type { CedearPriceMap, CedearState, CedearTransaction } from './types'

/** Último precio ARS de cada ticker (`/api/cedears/prices`, proxy a data912) */
export const fetchCedearPrices = (tickers: string[]) =>
  requestJson<CedearPriceMap>(`/api/cedears/prices?tickers=${encodeURIComponent(tickers.join(','))}`)

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
