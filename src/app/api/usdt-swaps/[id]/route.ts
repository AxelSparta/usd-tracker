import { requireUserId } from '@/server/auth'
import { errorResponse, parseIdParam } from '@/server/errors'
import { logEvent } from '@/server/log'
import { removeUsdtSwap } from '@/server/usdt-swaps'

type Context = { params: Promise<{ id: string }> }

/** DELETE /api/usdt-swaps/:usdtSwapId → `{ removedIds }` (las dos patas) */
export async function DELETE(_request: Request, { params }: Context) {
  try {
    const userId = await requireUserId()
    const id = await parseIdParam(params)
    const removedIds = await removeUsdtSwap(userId, id)
    logEvent('usdtSwap.removed', { userId, usdtSwapId: id })
    return Response.json({ removedIds })
  } catch (error) {
    return errorResponse(error)
  }
}
