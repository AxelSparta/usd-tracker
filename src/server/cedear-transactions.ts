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
import type { Scope } from './scope'

/**
 * Operaciones de CEDEARs (Fase 9.3). Cada escritura carga CEDEARs + Pesos + Dólar del usuario,
 * aplica la función pura (unidades, saldo de pesos o de USD CCL) y escribe la operación **y su
 * pata** en la misma transacción `Serializable`. Todo filtra por usuario y portafolio (`Scope` → 404).
 */

const NOT_FOUND = 'La operación no existe.'

export const loadCedearState = async (
  db: Pick<DbTransaction, 'cedearTransaction'>,
  scope: Scope,
): Promise<CedearState> => ({
  transactions: sortTxs(
    (await db.cedearTransaction.findMany({ where: scope })).map(toCedearTransaction),
  ),
})

export const listCedearTransactions = (scope: Scope) => loadCedearState(getDb(), scope)

/** Los tres módulos que toca una operación (no está en `loadLinkedState`: sería un ciclo de imports) */
const loadState = async (db: DbTransaction, scope: Scope): Promise<CedearLinkedState> => ({
  cedears: await loadCedearState(db, scope),
  ...(await loadLinkedState(db, scope, ['pesos', 'dolar'])),
})

const createLeg = (db: DbTransaction, scope: Scope, { module, leg }: FundingLeg) =>
  module === 'pesos'
    ? db.pesosMovement.create({ data: { id: leg.id, ...scope, ...toPesosMovementData(leg) } })
    : db.dolarTransaction.create({ data: { id: leg.id, ...scope, ...toDolarTransactionData(leg) } })

const removeLeg = (db: DbTransaction, scope: Scope, { module, leg }: FundingLeg) =>
  module === 'pesos'
    ? db.pesosMovement.delete({ where: { id: leg.id, ...scope } })
    : db.dolarTransaction.delete({ where: { id: leg.id, ...scope } })

/** Devuelve la operación y su pata (la pata la muestra el store de Pesos o del Dólar) */
export const createCedearTransaction = (
  scope: Scope,
  input: Omit<CedearTransaction, 'id'>,
  ids: CedearIds,
) =>
  withUserTransaction(scope.userId, async (db) => {
    const state = await loadState(db, scope)
    const { leg } = applyOrReject(() => applyAddCedearTransaction(state, input, ids))

    const row = await db.cedearTransaction.create({
      data: { id: ids.id, ...scope, ...toCedearTransactionData(input) },
    })
    await createLeg(db, scope, leg)
    return { transaction: toCedearTransaction(row), leg }
  })

/** La pata conserva su id; si cambió la moneda, se mueve de tabla (Pesos ↔ Dólar CCL) */
export const updateCedearTransaction = (
  scope: Scope,
  id: string,
  input: Omit<CedearTransaction, 'id'>,
) =>
  withUserTransaction(scope.userId, async (db) => {
    const state = await loadState(db, scope)
    const result = applyOrReject(() => applyUpdateCedearTransaction(state, id, input))
    if (!result) throw new ApiError(404, NOT_FOUND)
    const { leg, previous } = result

    const row = await db.cedearTransaction.update({
      where: { id, ...scope },
      data: toCedearTransactionData(input),
    })
    if (leg.module === 'pesos' && previous.module === 'pesos') {
      await db.pesosMovement.update({
        where: { id: leg.leg.id, ...scope },
        data: toPesosMovementData(leg.leg),
      })
    } else if (leg.module === 'dolar' && previous.module === 'dolar') {
      await db.dolarTransaction.update({
        where: { id: leg.leg.id, ...scope },
        data: toDolarTransactionData(leg.leg),
      })
    } else {
      await removeLeg(db, scope, previous)
      await createLeg(db, scope, leg)
    }
    return { transaction: toCedearTransaction(row), leg }
  })

export const removeCedearTransaction = (scope: Scope, id: string) =>
  withUserTransaction(scope.userId, async (db) => {
    const state = await loadState(db, scope)
    const result = applyOrReject(() => applyRemoveCedearTransaction(state, id))
    if (!result) throw new ApiError(404, NOT_FOUND)

    await db.cedearTransaction.delete({ where: { id, ...scope } })
    if (result.previous) await removeLeg(db, scope, result.previous)
  })
