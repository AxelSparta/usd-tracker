import { requireUserId } from '@/server/auth'
import { createCryptoSwap } from '@/server/crypto-transactions'
import { errorResponse, parseBody } from '@/server/errors'
import { cryptoSwapApiSchema } from '@/features/crypto/validations'

/** POST /api/crypto/swaps `{ swap, ids }` → 201 `[venta, compra]` */
export async function POST(request: Request) {
  try {
    const userId = await requireUserId()
    const { swap, ids } = await parseBody(request, cryptoSwapApiSchema)
    return Response.json(await createCryptoSwap(userId, swap, ids), { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
