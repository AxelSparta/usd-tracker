import { requireUserId } from '@/server/auth'
import {
  createCryptoTransaction,
  listCryptoTransactions,
} from '@/server/crypto-transactions'
import { errorResponse, parseBody } from '@/server/errors'
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
    return Response.json(await createCryptoTransaction(userId, transaction, coin), {
      status: 201,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
