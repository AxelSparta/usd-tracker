import { sortTxs } from '@/domain/timeline'
import {
  applyAddCedearTransaction,
  applyRemoveCedearTransaction,
  applyUpdateCedearTransaction,
  type CedearIds,
  type CedearLinkedState,
  type FundingLeg,
} from '@/features/cedears/operations'
import type { CedearState, CedearTransaction } from '@/features/cedears/types'
import { getDb, withUserTransaction, type DbTransaction } from './db'
import { ApiError, applyOrReject } from './errors'
import { loadLinkedState } from './linked-state'
import {
  toCedearTransaction,
  toCedearTransactionData,
  toDolarTransactionData,
  toPesosMovementData,
} from './mappers'

/**
 * Operaciones de CEDEARs (Fase 9.3). Cada escritura carga CEDEARs + Pesos + Dólar del usuario,
 * aplica la función pura (unidades, saldo de pesos o de USD CCL) y escribe la operación **y su
 * pata** en la misma transacción `Serializable`. Todo filtra por `userId` (ownership → 404).
 */

const NOT_FOUND = 'La operación no existe.'

export const loadCedearState = async (
  db: Pick<DbTransaction, 'cedearTransaction'>,
  userId: string,
): Promise<CedearState> => ({
  transactions: sortTxs(
    (await db.cedearTransaction.findMany({ where: { userId } })).map(toCedearTransaction),
  ),
})

export const listCedearTransactions = (userId: string) => loadCedearState(getDb(), userId)

/** Los tres módulos que toca una operación (no está en `loadLinkedState`: sería un ciclo de imports) */
const loadState = async (db: DbTransaction, userId: string): Promise<CedearLinkedState> => ({
  cedears: await loadCedearState(db, userId),
  ...(await loadLinkedState(db, userId, ['pesos', 'dolar'])),
})

const createLeg = (db: DbTransaction, userId: string, { module, leg }: FundingLeg) =>
  module === 'pesos'
    ? db.pesosMovement.create({ data: { id: leg.id, userId, ...toPesosMovementData(leg) } })
    : db.dolarTransaction.create({ data: { id: leg.id, userId, ...toDolarTransactionData(leg) } })

const removeLeg = (db: DbTransaction, userId: string, { module, leg }: FundingLeg) =>
  module === 'pesos'
    ? db.pesosMovement.delete({ where: { id: leg.id, userId } })
    : db.dolarTransaction.delete({ where: { id: leg.id, userId } })

/** Devuelve la operación y su pata (la pata la muestra el store de Pesos o del Dólar) */
export const createCedearTransaction = (
  userId: string,
  input: Omit<CedearTransaction, 'id'>,
  ids: CedearIds,
) =>
  withUserTransaction(userId, async (db) => {
    const state = await loadState(db, userId)
    const { leg } = applyOrReject(() => applyAddCedearTransaction(state, input, ids))

    const row = await db.cedearTransaction.create({
      data: { id: ids.id, userId, ...toCedearTransactionData(input) },
    })
    await createLeg(db, userId, leg)
    return { transaction: toCedearTransaction(row), leg }
  })

/** La pata conserva su id; si cambió la moneda, se mueve de tabla (Pesos ↔ Dólar CCL) */
export const updateCedearTransaction = (
  userId: string,
  id: string,
  input: Omit<CedearTransaction, 'id'>,
) =>
  withUserTransaction(userId, async (db) => {
    const state = await loadState(db, userId)
    const result = applyOrReject(() => applyUpdateCedearTransaction(state, id, input))
    if (!result) throw new ApiError(404, NOT_FOUND)
    const { leg, previous } = result

    const row = await db.cedearTransaction.update({
      where: { id, userId },
      data: toCedearTransactionData(input),
    })
    if (leg.module === 'pesos' && previous.module === 'pesos') {
      await db.pesosMovement.update({
        where: { id: leg.leg.id, userId },
        data: toPesosMovementData(leg.leg),
      })
    } else if (leg.module === 'dolar' && previous.module === 'dolar') {
      await db.dolarTransaction.update({
        where: { id: leg.leg.id, userId },
        data: toDolarTransactionData(leg.leg),
      })
    } else {
      await removeLeg(db, userId, previous)
      await createLeg(db, userId, leg)
    }
    return { transaction: toCedearTransaction(row), leg }
  })

export const removeCedearTransaction = (userId: string, id: string) =>
  withUserTransaction(userId, async (db) => {
    const state = await loadState(db, userId)
    const result = applyOrReject(() => applyRemoveCedearTransaction(state, id))
    if (!result) throw new ApiError(404, NOT_FOUND)

    await db.cedearTransaction.delete({ where: { id, userId } })
    if (result.previous) await removeLeg(db, userId, result.previous)
  })
