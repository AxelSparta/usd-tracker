import {
  applyAddTransaction,
  applyRemoveTransaction,
  applyUpdateTransaction,
  groupTransactions,
} from '@/domain/transactions'
import type { Transaction } from '@/types/transaction.types'
import { getDb, withUserTransaction, type DbTransaction } from './db'
import { ApiError, applyOrReject } from './errors'
import { toDolarTransaction, toDolarTransactionData } from './mappers'

/**
 * Operaciones del módulo dólar en la base. Todas filtran por `userId` (ownership):
 * una operación de otro usuario es, para este, inexistente (404).
 * Antes de escribir se valida la línea temporal con las mismas funciones que el store.
 */

const NOT_FOUND = 'La operación no existe.'

const loadGroups = async (db: DbTransaction, userId: string) =>
  groupTransactions(
    (await db.dolarTransaction.findMany({ where: { userId } })).map(toDolarTransaction),
  )

export const listDolarTransactions = async (userId: string): Promise<Transaction[]> =>
  (
    await getDb().dolarTransaction.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
    })
  ).map(toDolarTransaction)

export const createDolarTransaction = (userId: string, tx: Transaction) =>
  withUserTransaction(userId, async (db) => {
    const groups = await loadGroups(db, userId)
    applyOrReject(() => applyAddTransaction(groups, tx))

    const row = await db.dolarTransaction.create({
      data: { id: tx.id, userId, ...toDolarTransactionData(tx) },
    })
    return toDolarTransaction(row)
  })

export const updateDolarTransaction = (
  userId: string,
  id: string,
  tx: Omit<Transaction, 'id'>,
) =>
  withUserTransaction(userId, async (db) => {
    const groups = await loadGroups(db, userId)
    const updated = applyOrReject(() => applyUpdateTransaction(groups, id, tx))
    if (!updated) throw new ApiError(404, NOT_FOUND)

    const row = await db.dolarTransaction.update({
      where: { id, userId },
      data: toDolarTransactionData(tx),
    })
    return toDolarTransaction(row)
  })

export const removeDolarTransaction = (userId: string, id: string) =>
  withUserTransaction(userId, async (db) => {
    const groups = await loadGroups(db, userId)
    const updated = applyOrReject(() => applyRemoveTransaction(groups, id))
    if (!updated) throw new ApiError(404, NOT_FOUND)

    await db.dolarTransaction.delete({ where: { id, userId } })
  })
