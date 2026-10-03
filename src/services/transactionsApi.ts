import { requestJson } from '@/lib/http'
import type { Transaction } from '@/types/transaction.types'

/** Operaciones del dólar en la nube (`/api/dolar/transactions`), para usuarios con sesión. */

const BASE = '/api/dolar/transactions'

export const dolarTransactionsApi = {
  list: () => requestJson<Transaction[]>(BASE),
  create: (tx: Transaction) =>
    requestJson<Transaction>(BASE, { method: 'POST', body: tx }),
  update: (id: string, tx: Omit<Transaction, 'id'>) =>
    requestJson<Transaction>(`${BASE}/${id}`, { method: 'PATCH', body: tx }),
  remove: (id: string) => requestJson<void>(`${BASE}/${id}`, { method: 'DELETE' }),
}
