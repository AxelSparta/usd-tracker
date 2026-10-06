import { requestJson } from '@/lib/http'
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
