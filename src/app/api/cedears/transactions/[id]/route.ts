import { cedearTransactionApiSchema } from '@/features/cedears/validations'
import { requireUserId } from '@/server/auth'
import { removeCedearTransaction, updateCedearTransaction } from '@/server/cedear-transactions'
import { errorResponse, parseBody, parseIdParam } from '@/server/errors'
import { logEvent } from '@/server/log'

type Context = { params: Promise<{ id: string }> }

/** PATCH /api/cedears/transactions/:id (operación completa, sin id) → `{ transaction, leg }` */
export async function PATCH(request: Request, { params }: Context) {
  try {
    const userId = await requireUserId()
    const id = await parseIdParam(params)
    const input = await parseBody(request, cedearTransactionApiSchema)
    const updated = await updateCedearTransaction(userId, id, input)
    logEvent('cedear.updated', { userId, id, type: input.type, currency: input.currency })
    return Response.json(updated)
  } catch (error) {
    return errorResponse(error)
  }
}

/** DELETE /api/cedears/transactions/:id → 204 (borra también su pata) */
export async function DELETE(_request: Request, { params }: Context) {
  try {
    const userId = await requireUserId()
    const id = await parseIdParam(params)
    await removeCedearTransaction(userId, id)
    logEvent('cedear.removed', { userId, id })
    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
