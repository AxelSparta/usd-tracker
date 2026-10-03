import { requireUserId } from '@/server/auth'
import {
  removeDolarTransaction,
  updateDolarTransaction,
} from '@/server/dolar-transactions'
import { errorResponse, parseBody, parseIdParam } from '@/server/errors'
import { transactionApiSchema } from '@/validations/transaction'

type Context = { params: Promise<{ id: string }> }

/** PATCH /api/dolar/transactions/:id (operación completa, sin id) → `Transaction` */
export async function PATCH(request: Request, { params }: Context) {
  try {
    const userId = await requireUserId()
    const id = await parseIdParam(params)
    const tx = await parseBody(request, transactionApiSchema)
    return Response.json(await updateDolarTransaction(userId, id, tx))
  } catch (error) {
    return errorResponse(error)
  }
}

/** DELETE /api/dolar/transactions/:id → 204 */
export async function DELETE(_request: Request, { params }: Context) {
  try {
    const userId = await requireUserId()
    const id = await parseIdParam(params)
    await removeDolarTransaction(userId, id)
    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
