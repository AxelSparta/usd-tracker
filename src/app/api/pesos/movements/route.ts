import { createPesosMovementApiSchema } from '@/features/pesos/validations'
import { requireScope } from '@/server/scope'
import { errorResponse, parseBody } from '@/server/errors'
import { logEvent } from '@/server/log'
import { createPesosMovement, listPesosMovements } from '@/server/pesos-movements'

/** GET /api/pesos/movements → `{ movements }` del usuario */
export async function GET(request: Request) {
  try {
    const scope = await requireScope(request)
    return Response.json(await listPesosMovements(scope))
  } catch (error) {
    return errorResponse(error)
  }
}

/** POST /api/pesos/movements (id generado por el cliente) → 201 `PesosMovement` */
export async function POST(request: Request) {
  try {
    const scope = await requireScope(request)
    const movement = await parseBody(request, createPesosMovementApiSchema)
    const created = await createPesosMovement(scope, movement)
    logEvent('pesos.created', { ...scope, type: movement.type })
    return Response.json(created, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
