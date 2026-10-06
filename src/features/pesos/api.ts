import { requestJson } from '@/lib/http'
import type { Transaction } from '@/types/transaction.types'
import type { ConversionIds, ConversionInput } from './conversions'
import type { PesosMovement, PesosState } from './types'

/** Movimientos de pesos en la nube (`/api/pesos/movements`), para usuarios con sesión. */

const BASE = '/api/pesos/movements'

export const pesosApi = {
  list: () => requestJson<PesosState>(BASE),
  create: (movement: PesosMovement) =>
    requestJson<PesosMovement>(BASE, { method: 'POST', body: movement }),
  update: (id: string, movement: Omit<PesosMovement, 'id'>) =>
    requestJson<PesosMovement>(`${BASE}/${id}`, { method: 'PATCH', body: movement }),
  remove: (id: string) => requestJson<void>(`${BASE}/${id}`, { method: 'DELETE' }),
}

/** Conversiones pesos ↔ dólar (`/api/pesos/conversions`): escriben las dos tablas a la vez */
const CONVERSIONS = '/api/pesos/conversions'

export const conversionsApi = {
  create: (conversion: ConversionInput, ids: ConversionIds) =>
    requestJson<[PesosMovement, Transaction]>(CONVERSIONS, {
      method: 'POST',
      body: { conversion, ids },
    }),
  remove: (conversionId: string) =>
    requestJson<{ removedIds: string[] }>(`${CONVERSIONS}/${conversionId}`, { method: 'DELETE' }),
}
