import {
  applyAddPesosMovement,
  applyRemovePesosMovement,
  applyUpdatePesosMovement,
} from '@/features/pesos/operations'
import type { PesosMovement, PesosState } from '@/features/pesos/types'
import { getDb, withUserTransaction, type DbTransaction } from './db'
import { ApiError, applyOrReject } from './errors'
import { toPesosMovement, toPesosMovementData } from './mappers'
import type { Scope } from './scope'

/**
 * Movimientos de pesos en la base. Todos filtran por usuario y portafolio (`Scope`): un
 * movimiento de otro portafolio o usuario es, para este, inexistente (404). Antes de escribir se valida la línea temporal
 * con las mismas funciones que el store.
 */

const NOT_FOUND = 'El movimiento no existe.'

export const loadPesosState = async (
  db: Pick<DbTransaction, 'pesosMovement'>,
  scope: Scope,
): Promise<PesosState> => ({
  movements: (
    await db.pesosMovement.findMany({ where: scope, orderBy: { date: 'asc' } })
  ).map(toPesosMovement),
})

export const listPesosMovements = (scope: Scope) => loadPesosState(getDb(), scope)

export const createPesosMovement = (scope: Scope, movement: PesosMovement) =>
  withUserTransaction(scope.userId, async (db) => {
    const state = await loadPesosState(db, scope)
    applyOrReject(() => applyAddPesosMovement(state, movement))

    const row = await db.pesosMovement.create({
      data: { id: movement.id, ...scope, ...toPesosMovementData(movement) },
    })
    return toPesosMovement(row)
  })

export const updatePesosMovement = (
  scope: Scope,
  id: string,
  movement: Omit<PesosMovement, 'id'>,
) =>
  withUserTransaction(scope.userId, async (db) => {
    const state = await loadPesosState(db, scope)
    const updated = applyOrReject(() => applyUpdatePesosMovement(state, id, movement))
    if (!updated) throw new ApiError(404, NOT_FOUND)

    // Sin `note` en el body = se quitó la nota (el mapper la deja en null)
    const row = await db.pesosMovement.update({
      where: { id, ...scope },
      data: toPesosMovementData(movement),
    })
    return toPesosMovement(row)
  })

export const removePesosMovement = (scope: Scope, id: string) =>
  withUserTransaction(scope.userId, async (db) => {
    const state = await loadPesosState(db, scope)
    const updated = applyOrReject(() => applyRemovePesosMovement(state, id))
    if (!updated) throw new ApiError(404, NOT_FOUND)

    await db.pesosMovement.delete({ where: { id, ...scope } })
  })
