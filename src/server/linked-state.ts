import { loadCryptoState } from './crypto-transactions'
import type { DbTransaction } from './db'
import { loadGroups } from './dolar-transactions'
import { loadPesosState } from './pesos-movements'

/**
 * Estado de los módulos que toca una operación enlazada (intercambio USDT, conversión de pesos),
 * leído dentro de la misma `withUserTransaction` en la que después se escriben las patas.
 */

const loaders = {
  dolar: loadGroups,
  crypto: loadCryptoState,
  pesos: loadPesosState,
}

type Module = keyof typeof loaders
type Loaded = { [M in Module]: Awaited<ReturnType<(typeof loaders)[M]>> }

export const loadLinkedState = async <M extends Module>(
  db: DbTransaction,
  userId: string,
  modules: readonly M[],
): Promise<Pick<Loaded, M>> => {
  const state: Partial<Loaded> = {}
  // En serie: las consultas de una transacción interactiva van por la misma conexión
  for (const name of modules) {
    Object.assign(state, { [name]: await loaders[name](db, userId) })
  }
  return state as Pick<Loaded, M>
}
