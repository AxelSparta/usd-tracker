import { format } from 'date-fns'
import { findNegativeBalance, sortTxs } from '@/domain/timeline'
import { TransactionType } from '@/types/transaction.types'
import type { PesosMovement, PesosState } from './types'

/**
 * Operaciones del módulo Pesos. Puras: devuelven el estado nuevo o lanzan `Error` (mensaje en
 * español) si el saldo de pesos queda negativo en algún punto. Las usan el store (cliente) y la
 * API (server), así los dos validan igual.
 */

/** Las patas de una conversión pesos ↔ dólar solo se borran completas (8.2) */
export const CONVERSION_LEG_UPDATE =
  'Las conversiones no se editan: borrala y cargala de nuevo.'
export const CONVERSION_LEG_REMOVE = 'Es una conversión con dólares: borrala completa.'

/** Las patas de una operación de CEDEAR se modifican desde su dueña (`features/cedears`, D6) */
export const CEDEAR_LEG_CHANGE = 'Es parte de una operación de CEDEAR: modificala desde CEDEARs.'

const formatDate = (date: Date | string) => format(new Date(date), 'dd/MM/yyyy')

/** Saldo en ARS después de todos los movimientos */
export const computePesosBalance = (movements: PesosMovement[]) =>
  movements.reduce(
    (balance, m) => balance + (m.type === TransactionType.BUY ? m.amount : -m.amount),
    0,
  )

/** Lanza si en algún punto de la línea temporal el saldo de pesos queda negativo */
export const validatePesosTimeline = (
  movements: PesosMovement[],
  message: (date: string) => string = (date) => `No tenés pesos suficientes el ${date}.`,
) => {
  const offending = findNegativeBalance(sortTxs(movements), (m) => m.amount)
  if (offending) throw new Error(message(formatDate(offending.date)))
}

/**
 * Montos positivos (la API ya lo valida; la importación y el store pasan por acá) y como mucho
 * un enlace por movimiento.
 */
export const assertPesosShape = (movement: Omit<PesosMovement, 'id'>) => {
  if (!Number.isFinite(movement.amount) || movement.amount <= 0) {
    throw new Error('El monto debe ser mayor a cero.')
  }
  if (movement.conversionId && movement.cedearId) {
    throw new Error('Un movimiento no puede ser parte de una conversión y de un CEDEAR.')
  }
}

export const applyAddPesosMovement = (
  { movements }: PesosState,
  movement: PesosMovement,
): PesosState => {
  assertPesosShape(movement)
  const next = sortTxs([...movements, movement])
  validatePesosTimeline(next)
  return { movements: next }
}

/** `null` si el movimiento no existe */
export const applyUpdatePesosMovement = (
  { movements }: PesosState,
  movementId: string,
  movement: Omit<PesosMovement, 'id'>,
): PesosState | null => {
  const previous = movements.find((m) => m.id === movementId)
  if (!previous) return null
  if (previous.conversionId) throw new Error(CONVERSION_LEG_UPDATE)
  if (previous.cedearId) throw new Error(CEDEAR_LEG_CHANGE)
  assertPesosShape(movement)

  const next = sortTxs(
    movements.map((m) => (m.id === movementId ? { id: movementId, ...movement } : m)),
  )
  validatePesosTimeline(next, (date) => `No tenés pesos suficientes para el egreso del ${date}.`)
  return { movements: next }
}

/** `null` si el movimiento no existe */
export const applyRemovePesosMovement = (
  { movements }: PesosState,
  movementId: string,
): PesosState | null => {
  const target = movements.find((m) => m.id === movementId)
  if (!target) return null
  if (target.conversionId) throw new Error(CONVERSION_LEG_REMOVE)
  if (target.cedearId) throw new Error(CEDEAR_LEG_CHANGE)

  const next = movements.filter((m) => m.id !== movementId)
  validatePesosTimeline(
    next,
    (date) => `No se puede eliminar: el egreso del ${date} quedaría sin saldo.`,
  )
  return { movements: next }
}
