import { requireScope } from '@/server/scope'
import { errorResponse, parseIdParam } from '@/server/errors'
import { logEvent } from '@/server/log'
import { removeConversion } from '@/server/pesos-conversions'

type Context = { params: Promise<{ id: string }> }

/** DELETE /api/pesos/conversions/:conversionId → `{ removedIds }` (las dos patas) */
export async function DELETE(request: Request, { params }: Context) {
  try {
    const scope = await requireScope(request)
    const id = await parseIdParam(params)
    const removedIds = await removeConversion(scope, id)
    logEvent('pesosConversion.removed', { ...scope, conversionId: id })
    return Response.json({ removedIds })
  } catch (error) {
    return errorResponse(error)
  }
}
