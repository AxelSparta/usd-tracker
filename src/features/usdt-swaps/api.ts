import { requestJson } from '@/lib/http'
import type { CryptoTransaction } from '@/features/crypto/types'
import type { Transaction } from '@/types/transaction.types'
import type { UsdtSwapIds, UsdtSwapInput } from './operations'

/** Intercambios USDT ↔ cripto en la nube (`/api/usdt-swaps`), para usuarios con sesión. */

const BASE = '/api/usdt-swaps'

export const usdtSwapsApi = {
  create: (swap: UsdtSwapInput, ids: UsdtSwapIds) =>
    requestJson<[Transaction, CryptoTransaction]>(BASE, { method: 'POST', body: { swap, ids } }),
  remove: (usdtSwapId: string) =>
    requestJson<{ removedIds: string[] }>(`${BASE}/${usdtSwapId}`, { method: 'DELETE' }),
}
