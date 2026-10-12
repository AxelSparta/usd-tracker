import { requireScope } from '@/server/scope'
import { createCryptoSwap } from '@/server/crypto-transactions'
import { errorResponse, parseBody } from '@/server/errors'
import { logEvent } from '@/server/log'
import { cryptoSwapApiSchema } from '@/features/crypto/validations'

/** POST /api/crypto/swaps `{ swap, ids }` → 201 `[venta, compra]` */
export async function POST(request: Request) {
  try {
    const scope = await requireScope(request)
    const { swap, ids } = await parseBody(request, cryptoSwapApiSchema)
    const legs = await createCryptoSwap(scope, swap, ids)
    logEvent('crypto.swapped', { ...scope, from: swap.from.id, to: swap.to.id })
    return Response.json(legs, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
