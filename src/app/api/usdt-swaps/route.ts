import { requireScope } from '@/server/scope'
import { errorResponse, parseBody } from '@/server/errors'
import { logEvent } from '@/server/log'
import { createUsdtSwap } from '@/server/usdt-swaps'
import { usdtSwapApiSchema } from '@/features/usdt-swaps/validations'

/** POST /api/usdt-swaps `{ swap, ids }` → 201 `[pata dólar, pata cripto]` */
export async function POST(request: Request) {
  try {
    const scope = await requireScope(request)
    const { swap, ids } = await parseBody(request, usdtSwapApiSchema)
    const legs = await createUsdtSwap(scope, swap, ids)
    logEvent('usdtSwap.created', {
      ...scope,
      usdtSwapId: ids.usdtSwapId,
      direction: swap.direction,
      coinId: swap.coin.id,
    })
    return Response.json(legs, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
