import { requireUserId } from '@/server/auth'
import { errorResponse, parseIdParam } from '@/server/errors'
import { logEvent } from '@/server/log'
import { removeConversion } from '@/server/pesos-conversions'

type Context = { params: Promise<{ id: string }> }

/** DELETE /api/pesos/conversions/:conversionId → `{ removedIds }` (las dos patas) */
export async function DELETE(_request: Request, { params }: Context) {
  try {
    const userId = await requireUserId()
    const id = await parseIdParam(params)
    const removedIds = await removeConversion(userId, id)
    logEvent('pesosConversion.removed', { userId, conversionId: id })
    return Response.json({ removedIds })
  } catch (error) {
    return errorResponse(error)
  }
}
