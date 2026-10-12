import { requireScope } from '@/server/scope'
import {
  removeDolarTransaction,
  updateDolarTransaction,
} from '@/server/dolar-transactions'
import { errorResponse, parseBody, parseIdParam } from '@/server/errors'
import { logEvent } from '@/server/log'
import { transactionApiSchema } from '@/validations/transaction'

type Context = { params: Promise<{ id: string }> }

/** PATCH /api/dolar/transactions/:id (operación completa, sin id) → `Transaction` */
export async function PATCH(request: Request, { params }: Context) {
  try {
    const scope = await requireScope(request)
    const id = await parseIdParam(params)
    const tx = await parseBody(request, transactionApiSchema)
    const updated = await updateDolarTransaction(scope, id, tx)
    logEvent('dolar.updated', { ...scope, id, type: tx.type, dolarOption: tx.dolarOption })
    return Response.json(updated)
  } catch (error) {
    return errorResponse(error)
  }
}

/** DELETE /api/dolar/transactions/:id → 204 */
export async function DELETE(request: Request, { params }: Context) {
  try {
    const scope = await requireScope(request)
    const id = await parseIdParam(params)
    await removeDolarTransaction(scope, id)
    logEvent('dolar.removed', { ...scope, id })
    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
