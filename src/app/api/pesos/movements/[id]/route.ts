import { pesosMovementApiSchema } from '@/features/pesos/validations'
import { requireUserId } from '@/server/auth'
import { errorResponse, parseBody, parseIdParam } from '@/server/errors'
import { logEvent } from '@/server/log'
import { removePesosMovement, updatePesosMovement } from '@/server/pesos-movements'

type Context = { params: Promise<{ id: string }> }

/** PATCH /api/pesos/movements/:id (movimiento completo, sin id) → `PesosMovement` */
export async function PATCH(request: Request, { params }: Context) {
  try {
    const userId = await requireUserId()
    const id = await parseIdParam(params)
    const movement = await parseBody(request, pesosMovementApiSchema)
    const updated = await updatePesosMovement(userId, id, movement)
    logEvent('pesos.updated', { userId, id, type: movement.type })
    return Response.json(updated)
  } catch (error) {
    return errorResponse(error)
  }
}

/** DELETE /api/pesos/movements/:id → 204 */
export async function DELETE(_request: Request, { params }: Context) {
  try {
    const userId = await requireUserId()
    const id = await parseIdParam(params)
    await removePesosMovement(userId, id)
    logEvent('pesos.removed', { userId, id })
    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
