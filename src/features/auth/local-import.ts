import type { CryptoPortfolioState } from '@/features/crypto/operations'
import type { Transaction } from '@/types/transaction.types'

/**
 * Subida de los datos locales a la nube (Fase 3). Funciones puras: qué falta subir,
 * cuántas operaciones son y cómo armar el body de `POST /api/sync/import`.
 */

export type LocalData = {
  dolar: Transaction[]
  crypto: CryptoPortfolioState
}

export const EMPTY_LOCAL_DATA: LocalData = {
  dolar: [],
  crypto: { transactions: [], coins: {} },
}

export const countLocalData = (data: LocalData) =>
  data.dolar.length + data.crypto.transactions.length

export const localDataIds = (data: LocalData): string[] => [
  ...data.dolar.map((t) => t.id),
  ...data.crypto.transactions.map((t) => t.id),
]

/** Solo las operaciones cuyo id no está en `excluded` (y las monedas que usan) */
export const excludeIds = (data: LocalData, excluded: Set<string>): LocalData => {
  const transactions = data.crypto.transactions.filter((t) => !excluded.has(t.id))
  const coinIds = new Set(transactions.map((t) => t.coinId))
  return {
    dolar: data.dolar.filter((t) => !excluded.has(t.id)),
    crypto: {
      transactions,
      coins: Object.fromEntries(
        Object.entries(data.crypto.coins).filter(([id]) => coinIds.has(id)),
      ),
    },
  }
}

/** Lo local que todavía no está en la nube (comparando ids) */
export const localNotInCloud = (local: LocalData, cloud: LocalData): LocalData =>
  excludeIds(local, new Set(localDataIds(cloud)))

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Body para la API: la base guarda ids UUID. Si algún dato viejo tiene otro formato,
 * recibe un UUID nuevo (los `swapId` se remapean igual, así el intercambio sigue enlazado).
 */
export const toImportPayload = (
  data: LocalData,
  newId: () => string = () => crypto.randomUUID(),
): LocalData => {
  const remapped = new Map<string, string>()
  const fix = (id: string) => {
    if (UUID.test(id)) return id
    if (!remapped.has(id)) remapped.set(id, newId())
    return remapped.get(id)!
  }
  return {
    dolar: data.dolar.map((t) => ({ ...t, id: fix(t.id) })),
    crypto: {
      transactions: data.crypto.transactions.map((t) => ({
        ...t,
        id: fix(t.id),
        ...(t.swapId && { swapId: fix(t.swapId) }),
      })),
      coins: data.crypto.coins,
    },
  }
}
