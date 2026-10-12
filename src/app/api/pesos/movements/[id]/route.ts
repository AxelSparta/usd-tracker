import { pesosMovementApiSchema } from '@/features/pesos/validations'
import { requireScope } from '@/server/scope'
import { errorResponse, parseBody, parseIdParam } from '@/server/errors'
import { logEvent } from '@/server/log'
import { removePesosMovement, updatePesosMovement } from '@/server/pesos-movements'

type Context = { params: Promise<{ id: string }> }

/** PATCH /api/pesos/movements/:id (movimiento completo, sin id) → `PesosMovement` */
export async function PATCH(request: Request, { params }: Context) {
  try {
    const scope = await requireScope(request)
    const id = await parseIdParam(params)
    const movement = await parseBody(request, pesosMovementApiSchema)
    const updated = await updatePesosMovement(scope, id, movement)
    logEvent('pesos.updated', { ...scope, id, type: movement.type })
    return Response.json(updated)
  } catch (error) {
    return errorResponse(error)
  }
}

/** DELETE /api/pesos/movements/:id → 204 */
export async function DELETE(request: Request, { params }: Context) {
  try {
    const scope = await requireScope(request)
    const id = await parseIdParam(params)
    await removePesosMovement(scope, id)
    logEvent('pesos.removed', { ...scope, id })
    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
