import { requireScope } from '@/server/scope'
import { errorResponse, parseIdParam } from '@/server/errors'
import { logEvent } from '@/server/log'
import { removeUsdtSwap } from '@/server/usdt-swaps'

type Context = { params: Promise<{ id: string }> }

/** DELETE /api/usdt-swaps/:usdtSwapId → `{ removedIds }` (las dos patas) */
export async function DELETE(request: Request, { params }: Context) {
  try {
    const scope = await requireScope(request)
    const id = await parseIdParam(params)
    const removedIds = await removeUsdtSwap(scope, id)
    logEvent('usdtSwap.removed', { ...scope, usdtSwapId: id })
    return Response.json({ removedIds })
  } catch (error) {
    return errorResponse(error)
  }
}
