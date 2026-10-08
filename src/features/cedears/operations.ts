import type { PesosMovement } from '@/features/pesos/types'
import type { Transaction } from '@/types/transaction.types'
import type { CedearLegOwner } from './types'

/**
 * Operaciones del módulo CEDEARs. Puras: las usan el store (cliente) y la API (server).
 * Cada operación tiene **una** pata que mueve su dinero (D8): un movimiento de Pesos si se pagó
 * en ARS o una operación del grupo `contadoconliqui` del Dólar si se pagó en CCL. La pata guarda
 * el id de la operación en `cedearId`.
 */

export const CEDEAR_LEGS_INCOMPLETE = 'Hay una operación de CEDEAR sin su pata de pesos o de dólares CCL.'

/**
 * Para la importación: cada operación tiene exactamente una pata, en el módulo que corresponde a
 * su moneda y del tipo contrario (comprar un CEDEAR es un egreso de pesos o una venta de CCL), y
 * cada `cedearId` apunta a una operación. Que la pata del Dólar vaya en el CCL lo valida
 * `assertDolarShape`.
 */
export const assertCedearLegsComplete = (
  cedears: CedearLegOwner[],
  dolar: Transaction[],
  pesos: PesosMovement[],
) => {
  const legs = new Map<string, { dolar: Transaction[]; pesos: PesosMovement[] }>(
    cedears.map((op) => [op.id, { dolar: [], pesos: [] }]),
  )
  for (const tx of dolar) {
    if (!tx.cedearId) continue
    const entry = legs.get(tx.cedearId)
    if (!entry) throw new Error(CEDEAR_LEGS_INCOMPLETE)
    entry.dolar.push(tx)
  }
  for (const m of pesos) {
    if (!m.cedearId) continue
    const entry = legs.get(m.cedearId)
    if (!entry) throw new Error(CEDEAR_LEGS_INCOMPLETE)
    entry.pesos.push(m)
  }

  for (const op of cedears) {
    const { dolar: dolarLegs, pesos: pesosLegs } = legs.get(op.id)!
    const [leg, ...extra] = op.currency === 'ARS' ? pesosLegs : dolarLegs
    const other = op.currency === 'ARS' ? dolarLegs : pesosLegs
    if (!leg || extra.length > 0 || other.length > 0 || leg.type === op.type) {
      throw new Error(CEDEAR_LEGS_INCOMPLETE)
    }
  }
}
