import { requireUserId } from '@/server/auth'
import {
  createDolarTransaction,
  listDolarTransactions,
} from '@/server/dolar-transactions'
import { errorResponse, parseBody } from '@/server/errors'
import { createTransactionApiSchema } from '@/validations/transaction'

/** GET /api/dolar/transactions → `Transaction[]` del usuario */
export async function GET() {
  try {
    const userId = await requireUserId()
    return Response.json(await listDolarTransactions(userId))
  } catch (error) {
    return errorResponse(error)
  }
}

/** POST /api/dolar/transactions (id generado por el cliente) → 201 `Transaction` */
export async function POST(request: Request) {
  try {
    const userId = await requireUserId()
    const tx = await parseBody(request, createTransactionApiSchema)
    return Response.json(await createDolarTransaction(userId, tx), { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
