import { cedearTransactionApiSchema } from '@/features/cedears/validations'
import { requireScope } from '@/server/scope'
import { removeCedearTransaction, updateCedearTransaction } from '@/server/cedear-transactions'
import { errorResponse, parseBody, parseIdParam } from '@/server/errors'
import { logEvent } from '@/server/log'

type Context = { params: Promise<{ id: string }> }

/** PATCH /api/cedears/transactions/:id (operación completa, sin id) → `{ transaction, leg }` */
export async function PATCH(request: Request, { params }: Context) {
  try {
    const scope = await requireScope(request)
    const id = await parseIdParam(params)
    const input = await parseBody(request, cedearTransactionApiSchema)
    const updated = await updateCedearTransaction(scope, id, input)
    logEvent('cedear.updated', { ...scope, id, type: input.type, currency: input.currency })
    return Response.json(updated)
  } catch (error) {
    return errorResponse(error)
  }
}

/** DELETE /api/cedears/transactions/:id → 204 (borra también su pata) */
export async function DELETE(request: Request, { params }: Context) {
  try {
    const scope = await requireScope(request)
    const id = await parseIdParam(params)
    await removeCedearTransaction(scope, id)
    logEvent('cedear.removed', { ...scope, id })
    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
