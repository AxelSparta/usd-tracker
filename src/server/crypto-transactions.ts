import {
  applyAddCryptoTransaction,
  applyAddSwap,
  applyRemoveCryptoTransaction,
  applyUpdateCryptoTransaction,
  buildSwapLegs,
  type CryptoPortfolioState,
  type CryptoSwapInput,
  type SwapIds,
} from '@/features/crypto/operations'
import type { Coin, CryptoTransaction } from '@/features/crypto/types'
import { getDb, withUserTransaction, type DbTransaction } from './db'
import { ApiError, applyOrReject } from './errors'
import { toCoin, toCryptoTransaction, toCryptoTransactionData } from './mappers'
import type { Scope } from './scope'

/**
 * Operaciones del módulo cripto en la base. Todas filtran por usuario y portafolio
 * (`Scope`): una operación de otro portafolio o usuario es, para este, inexistente (404).
 * Antes de escribir se valida la línea temporal con las mismas funciones que el store.
 */

const NOT_FOUND = 'La operación no existe.'

export const loadCryptoState = async (
  db: Pick<DbTransaction, 'cryptoTransaction'>,
  scope: Scope,
): Promise<CryptoPortfolioState> => {
  const rows = await db.cryptoTransaction.findMany({
    where: scope,
    orderBy: { date: 'asc' },
  })
  const coins: Record<string, Coin> = {}
  for (const row of rows) coins[row.coinId] = toCoin(row)
  return { transactions: rows.map(toCryptoTransaction), coins }
}

export const listCryptoTransactions = (scope: Scope) => loadCryptoState(getDb(), scope)

export const createCryptoTransaction = (
  scope: Scope,
  tx: CryptoTransaction,
  coin: Coin,
) =>
  withUserTransaction(scope.userId, async (db) => {
    const state = await loadCryptoState(db, scope)
    applyOrReject(() => applyAddCryptoTransaction(state, tx, coin))

    const row = await db.cryptoTransaction.create({
      data: { id: tx.id, ...scope, ...toCryptoTransactionData(tx, coin) },
    })
    return toCryptoTransaction(row)
  })

export const updateCryptoTransaction = (
  scope: Scope,
  id: string,
  tx: Omit<CryptoTransaction, 'id'>,
  coin: Coin,
) =>
  withUserTransaction(scope.userId, async (db) => {
    const state = await loadCryptoState(db, scope)
    const updated = applyOrReject(() =>
      applyUpdateCryptoTransaction(state, id, tx, coin),
    )
    if (!updated) throw new ApiError(404, NOT_FOUND)

    // Sin `fee` en el body = se quitó la comisión (el mapper la deja en null)
    const row = await db.cryptoTransaction.update({
      where: { id, ...scope },
      data: toCryptoTransactionData(tx, coin),
    })
    return toCryptoTransaction(row)
  })

export const createCryptoSwap = (scope: Scope, swap: CryptoSwapInput, ids: SwapIds) =>
  withUserTransaction(scope.userId, async (db) => {
    const state = await loadCryptoState(db, scope)
    applyOrReject(() => applyAddSwap(state, swap, ids))

    const legs = buildSwapLegs(swap, ids)
    const coins = [swap.from, swap.to]
    await db.cryptoTransaction.createMany({
      data: legs.map((leg, i) => ({
        id: leg.id,
        ...scope,
        ...toCryptoTransactionData(leg, coins[i]),
      })),
    })
    return legs
  })

/** Devuelve los ids borrados (las dos patas si era un intercambio) */
export const removeCryptoTransaction = (scope: Scope, id: string) =>
  withUserTransaction(scope.userId, async (db) => {
    const state = await loadCryptoState(db, scope)
    const result = applyOrReject(() => applyRemoveCryptoTransaction(state, id))
    if (!result) throw new ApiError(404, NOT_FOUND)

    await db.cryptoTransaction.deleteMany({
      where: { ...scope, id: { in: result.removedIds } },
    })
    return result.removedIds
  })
