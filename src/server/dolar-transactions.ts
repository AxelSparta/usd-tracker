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
import type { Scope } from './scope'

/**
 * Operaciones del módulo dólar en la base. Todas filtran por usuario y portafolio
 * (`Scope`): una operación de otro portafolio o usuario es, para este, inexistente (404).
 * Antes de escribir se valida la línea temporal con las mismas funciones que el store.
 */

const NOT_FOUND = 'La operación no existe.'

export const loadGroups = async (
  db: Pick<DbTransaction, 'dolarTransaction'>,
  scope: Scope,
) =>
  groupTransactions(
    (await db.dolarTransaction.findMany({ where: scope })).map(toDolarTransaction),
  )

export const listDolarTransactions = async (scope: Scope): Promise<Transaction[]> =>
  (
    await getDb().dolarTransaction.findMany({
      where: scope,
      orderBy: { date: 'asc' },
    })
  ).map(toDolarTransaction)

export const createDolarTransaction = (scope: Scope, tx: Transaction) =>
  withUserTransaction(scope.userId, async (db) => {
    const groups = await loadGroups(db, scope)
    applyOrReject(() => applyAddTransaction(groups, tx))

    const row = await db.dolarTransaction.create({
      data: { id: tx.id, ...scope, ...toDolarTransactionData(tx) },
    })
    return toDolarTransaction(row)
  })

export const updateDolarTransaction = (
  scope: Scope,
  id: string,
  tx: Omit<Transaction, 'id'>,
) =>
  withUserTransaction(scope.userId, async (db) => {
    const groups = await loadGroups(db, scope)
    const updated = applyOrReject(() => applyUpdateTransaction(groups, id, tx))
    if (!updated) throw new ApiError(404, NOT_FOUND)

    const row = await db.dolarTransaction.update({
      where: { id, ...scope },
      data: toDolarTransactionData(tx),
    })
    return toDolarTransaction(row)
  })

export const removeDolarTransaction = (scope: Scope, id: string) =>
  withUserTransaction(scope.userId, async (db) => {
    const groups = await loadGroups(db, scope)
    const updated = applyOrReject(() => applyRemoveTransaction(groups, id))
    if (!updated) throw new ApiError(404, NOT_FOUND)

    await db.dolarTransaction.delete({ where: { id, ...scope } })
  })
