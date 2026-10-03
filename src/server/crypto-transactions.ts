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

/**
 * Operaciones del módulo cripto en la base. Todas filtran por `userId` (ownership):
 * una operación de otro usuario es, para este, inexistente (404).
 * Antes de escribir se valida la línea temporal con las mismas funciones que el store.
 */

const NOT_FOUND = 'La operación no existe.'

export const loadCryptoState = async (
  db: Pick<DbTransaction, 'cryptoTransaction'>,
  userId: string,
): Promise<CryptoPortfolioState> => {
  const rows = await db.cryptoTransaction.findMany({
    where: { userId },
    orderBy: { date: 'asc' },
  })
  const coins: Record<string, Coin> = {}
  for (const row of rows) coins[row.coinId] = toCoin(row)
  return { transactions: rows.map(toCryptoTransaction), coins }
}

export const listCryptoTransactions = (userId: string) => loadCryptoState(getDb(), userId)

export const createCryptoTransaction = (
  userId: string,
  tx: CryptoTransaction,
  coin: Coin,
) =>
  withUserTransaction(userId, async (db) => {
    const state = await loadCryptoState(db, userId)
    applyOrReject(() => applyAddCryptoTransaction(state, tx, coin))

    const row = await db.cryptoTransaction.create({
      data: { id: tx.id, userId, ...toCryptoTransactionData(tx, coin) },
    })
    return toCryptoTransaction(row)
  })

export const updateCryptoTransaction = (
  userId: string,
  id: string,
  tx: Omit<CryptoTransaction, 'id'>,
  coin: Coin,
) =>
  withUserTransaction(userId, async (db) => {
    const state = await loadCryptoState(db, userId)
    const updated = applyOrReject(() =>
      applyUpdateCryptoTransaction(state, id, tx, coin),
    )
    if (!updated) throw new ApiError(404, NOT_FOUND)

    // Sin `fee` en el body = se quitó la comisión (el mapper la deja en null)
    const row = await db.cryptoTransaction.update({
      where: { id, userId },
      data: toCryptoTransactionData(tx, coin),
    })
    return toCryptoTransaction(row)
  })

export const createCryptoSwap = (userId: string, swap: CryptoSwapInput, ids: SwapIds) =>
  withUserTransaction(userId, async (db) => {
    const state = await loadCryptoState(db, userId)
    applyOrReject(() => applyAddSwap(state, swap, ids))

    const legs = buildSwapLegs(swap, ids)
    const coins = [swap.from, swap.to]
    await db.cryptoTransaction.createMany({
      data: legs.map((leg, i) => ({
        id: leg.id,
        userId,
        ...toCryptoTransactionData(leg, coins[i]),
      })),
    })
    return legs
  })

/** Devuelve los ids borrados (las dos patas si era un intercambio) */
export const removeCryptoTransaction = (userId: string, id: string) =>
  withUserTransaction(userId, async (db) => {
    const state = await loadCryptoState(db, userId)
    const result = applyOrReject(() => applyRemoveCryptoTransaction(state, id))
    if (!result) throw new ApiError(404, NOT_FOUND)

    await db.cryptoTransaction.deleteMany({
      where: { userId, id: { in: result.removedIds } },
    })
    return result.removedIds
  })
