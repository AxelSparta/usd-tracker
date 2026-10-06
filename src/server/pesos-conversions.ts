import {
  applyAddConversion,
  applyRemoveConversion,
  buildConversionLegs,
  type ConversionIds,
  type ConversionInput,
} from '@/features/pesos/conversions'
import { withUserTransaction } from './db'
import { ApiError, applyOrReject } from './errors'
import { loadLinkedState } from './linked-state'
import { toDolarTransactionData, toPesosMovementData } from './mappers'

/**
 * Conversiones pesos ↔ dólar (Fase 8.2): escriben las dos tablas en una sola transacción
 * `Serializable`, validando las dos líneas temporales con las mismas funciones que los stores.
 */

const MODULES = ['pesos', 'dolar'] as const

export const createConversion = (userId: string, conversion: ConversionInput, ids: ConversionIds) =>
  withUserTransaction(userId, async (db) => {
    const state = await loadLinkedState(db, userId, MODULES)
    applyOrReject(() => applyAddConversion(state, conversion, ids))

    const [pesosLeg, dolarLeg] = buildConversionLegs(conversion, ids)
    await db.pesosMovement.create({
      data: { id: pesosLeg.id, userId, ...toPesosMovementData(pesosLeg) },
    })
    await db.dolarTransaction.create({
      data: { id: dolarLeg.id, userId, ...toDolarTransactionData(dolarLeg) },
    })
    return [pesosLeg, dolarLeg] as const
  })

/** Devuelve los ids borrados (las dos patas) */
export const removeConversion = (userId: string, conversionId: string) =>
  withUserTransaction(userId, async (db) => {
    const state = await loadLinkedState(db, userId, MODULES)
    const result = applyOrReject(() => applyRemoveConversion(state, conversionId))
    if (!result) throw new ApiError(404, 'La conversión no existe.')

    const where = { userId, id: { in: result.removedIds } }
    await db.pesosMovement.deleteMany({ where })
    await db.dolarTransaction.deleteMany({ where })
    return result.removedIds
  })
