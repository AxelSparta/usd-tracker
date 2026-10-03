import { requireUserId } from '@/server/auth'
import {
  createCryptoTransaction,
  listCryptoTransactions,
} from '@/server/crypto-transactions'
import { errorResponse, parseBody } from '@/server/errors'
import { logEvent } from '@/server/log'
import { createCryptoTransactionApiSchema } from '@/features/crypto/validations'

/** GET /api/crypto/transactions → `{ transactions, coins }` del usuario */
export async function GET() {
  try {
    const userId = await requireUserId()
    return Response.json(await listCryptoTransactions(userId))
  } catch (error) {
    return errorResponse(error)
  }
}

/** POST /api/crypto/transactions `{ transaction, coin }` (id del cliente) → 201 */
export async function POST(request: Request) {
  try {
    const userId = await requireUserId()
    const { transaction, coin } = await parseBody(
      request,
      createCryptoTransactionApiSchema,
    )
    const created = await createCryptoTransaction(userId, transaction, coin)
    logEvent('crypto.created', { userId, type: transaction.type, coinId: transaction.coinId })
    return Response.json(created, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
