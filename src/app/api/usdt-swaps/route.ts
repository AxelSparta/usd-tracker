import { requireUserId } from '@/server/auth'
import { errorResponse, parseBody } from '@/server/errors'
import { logEvent } from '@/server/log'
import { createUsdtSwap } from '@/server/usdt-swaps'
import { usdtSwapApiSchema } from '@/features/usdt-swaps/validations'

/** POST /api/usdt-swaps `{ swap, ids }` → 201 `[pata dólar, pata cripto]` */
export async function POST(request: Request) {
  try {
    const userId = await requireUserId()
    const { swap, ids } = await parseBody(request, usdtSwapApiSchema)
    const legs = await createUsdtSwap(userId, swap, ids)
    logEvent('usdtSwap.created', {
      userId,
      usdtSwapId: ids.usdtSwapId,
      direction: swap.direction,
      coinId: swap.coin.id,
    })
    return Response.json(legs, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
