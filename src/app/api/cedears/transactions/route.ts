import { createCedearTransactionApiSchema } from '@/features/cedears/validations'
import { requireScope } from '@/server/scope'
import { createCedearTransaction, listCedearTransactions } from '@/server/cedear-transactions'
import { errorResponse, parseBody } from '@/server/errors'
import { logEvent } from '@/server/log'

/** GET /api/cedears/transactions → `{ transactions }` del usuario */
export async function GET(request: Request) {
  try {
    const scope = await requireScope(request)
    return Response.json(await listCedearTransactions(scope))
  } catch (error) {
    return errorResponse(error)
  }
}

/**
 * POST /api/cedears/transactions (ids de la operación y de la pata generados por el cliente)
 * → 201 `{ transaction, leg }`: la pata es un movimiento de Pesos o una operación del Dólar CCL
 */
export async function POST(request: Request) {
  try {
    const scope = await requireScope(request)
    const { id, legId, ...input } = await parseBody(request, createCedearTransactionApiSchema)
    const created = await createCedearTransaction(scope, input, { id, legId })
    logEvent('cedear.created', { ...scope, id, type: input.type, currency: input.currency })
    return Response.json(created, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
