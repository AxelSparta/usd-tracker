import { requireUserId } from '@/server/auth'
import {
  removeCryptoTransaction,
  updateCryptoTransaction,
} from '@/server/crypto-transactions'
import { errorResponse, parseBody, parseIdParam } from '@/server/errors'
import { logEvent } from '@/server/log'
import { cryptoTransactionApiSchema } from '@/features/crypto/validations'

type Context = { params: Promise<{ id: string }> }

/** PATCH /api/crypto/transactions/:id `{ transaction, coin }` → `CryptoTransaction` */
export async function PATCH(request: Request, { params }: Context) {
  try {
    const userId = await requireUserId()
    const id = await parseIdParam(params)
    const { transaction, coin } = await parseBody(request, cryptoTransactionApiSchema)
    const updated = await updateCryptoTransaction(userId, id, transaction, coin)
    logEvent('crypto.updated', { userId, id, type: transaction.type, coinId: transaction.coinId })
    return Response.json(updated)
  } catch (error) {
    return errorResponse(error)
  }
}

/** DELETE /api/crypto/transactions/:id → `{ removedIds }` (ambas patas si es un intercambio) */
export async function DELETE(_request: Request, { params }: Context) {
  try {
    const userId = await requireUserId()
    const id = await parseIdParam(params)
    const removedIds = await removeCryptoTransaction(userId, id)
    logEvent('crypto.removed', { userId, id, count: removedIds.length })
    return Response.json({ removedIds })
  } catch (error) {
    return errorResponse(error)
  }
}
