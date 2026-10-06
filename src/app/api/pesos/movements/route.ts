import { createPesosMovementApiSchema } from '@/features/pesos/validations'
import { requireUserId } from '@/server/auth'
import { errorResponse, parseBody } from '@/server/errors'
import { logEvent } from '@/server/log'
import { createPesosMovement, listPesosMovements } from '@/server/pesos-movements'

/** GET /api/pesos/movements → `{ movements }` del usuario */
export async function GET() {
  try {
    const userId = await requireUserId()
    return Response.json(await listPesosMovements(userId))
  } catch (error) {
    return errorResponse(error)
  }
}

/** POST /api/pesos/movements (id generado por el cliente) → 201 `PesosMovement` */
export async function POST(request: Request) {
  try {
    const userId = await requireUserId()
    const movement = await parseBody(request, createPesosMovementApiSchema)
    const created = await createPesosMovement(userId, movement)
    logEvent('pesos.created', { userId, type: movement.type })
    return Response.json(created, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
