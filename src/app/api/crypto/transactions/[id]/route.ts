import { requireUserId } from '@/server/auth'
import {
  removeCryptoTransaction,
  updateCryptoTransaction,
} from '@/server/crypto-transactions'
import { errorResponse, parseBody, parseIdParam } from '@/server/errors'
import { cryptoTransactionApiSchema } from '@/features/crypto/validations'

type Context = { params: Promise<{ id: string }> }

/** PATCH /api/crypto/transactions/:id `{ transaction, coin }` → `CryptoTransaction` */
export async function PATCH(request: Request, { params }: Context) {
  try {
    const userId = await requireUserId()
    const id = await parseIdParam(params)
    const { transaction, coin } = await parseBody(request, cryptoTransactionApiSchema)
    return Response.json(await updateCryptoTransaction(userId, id, transaction, coin))
  } catch (error) {
    return errorResponse(error)
  }
}

/** DELETE /api/crypto/transactions/:id → `{ removedIds }` (ambas patas si es un intercambio) */
export async function DELETE(_request: Request, { params }: Context) {
  try {
    const userId = await requireUserId()
    const id = await parseIdParam(params)
    return Response.json({ removedIds: await removeCryptoTransaction(userId, id) })
  } catch (error) {
    return errorResponse(error)
  }
}
