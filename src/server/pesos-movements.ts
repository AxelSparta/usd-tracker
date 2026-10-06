import {
  applyAddPesosMovement,
  applyRemovePesosMovement,
  applyUpdatePesosMovement,
} from '@/features/pesos/operations'
import type { PesosMovement, PesosState } from '@/features/pesos/types'
import { getDb, withUserTransaction, type DbTransaction } from './db'
import { ApiError, applyOrReject } from './errors'
import { toPesosMovement, toPesosMovementData } from './mappers'

/**
 * Movimientos de pesos en la base. Todos filtran por `userId` (ownership): un movimiento de
 * otro usuario es, para este, inexistente (404). Antes de escribir se valida la línea temporal
 * con las mismas funciones que el store.
 */

const NOT_FOUND = 'El movimiento no existe.'

export const loadPesosState = async (
  db: Pick<DbTransaction, 'pesosMovement'>,
  userId: string,
): Promise<PesosState> => ({
  movements: (
    await db.pesosMovement.findMany({ where: { userId }, orderBy: { date: 'asc' } })
  ).map(toPesosMovement),
})

export const listPesosMovements = (userId: string) => loadPesosState(getDb(), userId)

export const createPesosMovement = (userId: string, movement: PesosMovement) =>
  withUserTransaction(userId, async (db) => {
    const state = await loadPesosState(db, userId)
    applyOrReject(() => applyAddPesosMovement(state, movement))

    const row = await db.pesosMovement.create({
      data: { id: movement.id, userId, ...toPesosMovementData(movement) },
    })
    return toPesosMovement(row)
  })

export const updatePesosMovement = (
  userId: string,
  id: string,
  movement: Omit<PesosMovement, 'id'>,
) =>
  withUserTransaction(userId, async (db) => {
    const state = await loadPesosState(db, userId)
    const updated = applyOrReject(() => applyUpdatePesosMovement(state, id, movement))
    if (!updated) throw new ApiError(404, NOT_FOUND)

    // Sin `note` en el body = se quitó la nota (el mapper la deja en null)
    const row = await db.pesosMovement.update({
      where: { id, userId },
      data: toPesosMovementData(movement),
    })
    return toPesosMovement(row)
  })

export const removePesosMovement = (userId: string, id: string) =>
  withUserTransaction(userId, async (db) => {
    const state = await loadPesosState(db, userId)
    const updated = applyOrReject(() => applyRemovePesosMovement(state, id))
    if (!updated) throw new ApiError(404, NOT_FOUND)

    await db.pesosMovement.delete({ where: { id, userId } })
  })
