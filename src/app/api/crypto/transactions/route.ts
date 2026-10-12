import { requireScope } from '@/server/scope'
import {
  createCryptoTransaction,
  listCryptoTransactions,
} from '@/server/crypto-transactions'
import { errorResponse, parseBody } from '@/server/errors'
import { logEvent } from '@/server/log'
import { createCryptoTransactionApiSchema } from '@/features/crypto/validations'

/** GET /api/crypto/transactions → `{ transactions, coins }` del usuario */
export async function GET(request: Request) {
  try {
    const scope = await requireScope(request)
    return Response.json(await listCryptoTransactions(scope))
  } catch (error) {
    return errorResponse(error)
  }
}

/** POST /api/crypto/transactions `{ transaction, coin }` (id del cliente) → 201 */
export async function POST(request: Request) {
  try {
    const scope = await requireScope(request)
    const { transaction, coin } = await parseBody(
      request,
      createCryptoTransactionApiSchema,
    )
    const created = await createCryptoTransaction(scope, transaction, coin)
    logEvent('crypto.created', { ...scope, type: transaction.type, coinId: transaction.coinId })
    return Response.json(created, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
