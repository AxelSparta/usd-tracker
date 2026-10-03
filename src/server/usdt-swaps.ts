import {
  applyAddUsdtSwap,
  applyRemoveUsdtSwap,
  buildUsdtSwapLegs,
  type UsdtSwapIds,
  type UsdtSwapInput,
} from '@/features/usdt-swaps/operations'
import { loadCryptoState } from './crypto-transactions'
import { withUserTransaction, type DbTransaction } from './db'
import { loadGroups } from './dolar-transactions'
import { ApiError, applyOrReject } from './errors'
import { toCryptoTransactionData, toDolarTransactionData } from './mappers'

/**
 * Intercambios USDT ↔ cripto (Fase 7a): escriben las dos tablas en una sola transacción
 * `Serializable`, validando las dos líneas temporales con las mismas funciones que los stores.
 */

const loadLinkedState = async (db: DbTransaction, userId: string) => ({
  dolar: await loadGroups(db, userId),
  crypto: await loadCryptoState(db, userId),
})

export const createUsdtSwap = (userId: string, swap: UsdtSwapInput, ids: UsdtSwapIds) =>
  withUserTransaction(userId, async (db) => {
    const state = await loadLinkedState(db, userId)
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
    const state = await loadLinkedState(db, userId)
    const result = applyOrReject(() => applyRemoveUsdtSwap(state, usdtSwapId))
    if (!result) throw new ApiError(404, 'El intercambio no existe.')

    const where = { userId, id: { in: result.removedIds } }
    await db.dolarTransaction.deleteMany({ where })
    await db.cryptoTransaction.deleteMany({ where })
    return result.removedIds
  })
