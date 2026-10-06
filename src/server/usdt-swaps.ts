import {
  applyAddUsdtSwap,
  applyRemoveUsdtSwap,
  buildUsdtSwapLegs,
  type UsdtSwapIds,
  type UsdtSwapInput,
} from '@/features/usdt-swaps/operations'
import { withUserTransaction } from './db'
import { ApiError, applyOrReject } from './errors'
import { loadLinkedState } from './linked-state'
import { toCryptoTransactionData, toDolarTransactionData } from './mappers'

/**
 * Intercambios USDT ↔ cripto (Fase 7a): escriben las dos tablas en una sola transacción
 * `Serializable`, validando las dos líneas temporales con las mismas funciones que los stores.
 */

const MODULES = ['dolar', 'crypto'] as const

export const createUsdtSwap = (userId: string, swap: UsdtSwapInput, ids: UsdtSwapIds) =>
  withUserTransaction(userId, async (db) => {
    const state = await loadLinkedState(db, userId, MODULES)
    applyOrReject(() => applyAddUsdtSwap(state, swap, ids))

    const [dolarLeg, cryptoLeg] = buildUsdtSwapLegs(swap, ids)
    await db.dolarTransaction.create({
      data: { id: dolarLeg.id, userId, ...toDolarTransactionData(dolarLeg) },
    })
    await db.cryptoTransaction.create({
      data: { id: cryptoLeg.id, userId, ...toCryptoTransactionData(cryptoLeg, swap.coin) },
    })
    return [dolarLeg, cryptoLeg] as const
  })

/** Devuelve los ids borrados (las dos patas) */
export const removeUsdtSwap = (userId: string, usdtSwapId: string) =>
  withUserTransaction(userId, async (db) => {
    const state = await loadLinkedState(db, userId, MODULES)
    const result = applyOrReject(() => applyRemoveUsdtSwap(state, usdtSwapId))
    if (!result) throw new ApiError(404, 'El intercambio no existe.')

    const where = { userId, id: { in: result.removedIds } }
    await db.dolarTransaction.deleteMany({ where })
    await db.cryptoTransaction.deleteMany({ where })
    return result.removedIds
  })
