import { createCedearTransactionApiSchema } from '@/features/cedears/validations'
import { requireUserId } from '@/server/auth'
import { createCedearTransaction, listCedearTransactions } from '@/server/cedear-transactions'
import { errorResponse, parseBody } from '@/server/errors'
import { logEvent } from '@/server/log'

/** GET /api/cedears/transactions → `{ transactions }` del usuario */
export async function GET() {
  try {
    const userId = await requireUserId()
    return Response.json(await listCedearTransactions(userId))
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
    const userId = await requireUserId()
    const { id, legId, ...input } = await parseBody(request, createCedearTransactionApiSchema)
    const created = await createCedearTransaction(userId, input, { id, legId })
    logEvent('cedear.created', { userId, id, type: input.type, currency: input.currency })
    return Response.json(created, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
