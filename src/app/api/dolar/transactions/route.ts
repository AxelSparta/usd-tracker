import { requireScope } from '@/server/scope'
import {
  createDolarTransaction,
  listDolarTransactions,
} from '@/server/dolar-transactions'
import { errorResponse, parseBody } from '@/server/errors'
import { logEvent } from '@/server/log'
import { createTransactionApiSchema } from '@/validations/transaction'

/** GET /api/dolar/transactions → `Transaction[]` del usuario */
export async function GET(request: Request) {
  try {
    const scope = await requireScope(request)
    return Response.json(await listDolarTransactions(scope))
  } catch (error) {
    return errorResponse(error)
  }
}

/** POST /api/dolar/transactions (id generado por el cliente) → 201 `Transaction` */
export async function POST(request: Request) {
  try {
    const scope = await requireScope(request)
    const tx = await parseBody(request, createTransactionApiSchema)
    const created = await createDolarTransaction(scope, tx)
    logEvent('dolar.created', { ...scope, type: tx.type, dolarOption: tx.dolarOption })
    return Response.json(created, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
