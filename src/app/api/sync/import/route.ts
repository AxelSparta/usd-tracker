import { requireUserId } from '@/server/auth'
import { errorResponse, parseBody } from '@/server/errors'
import { importLocalData, importSchema } from '@/server/import'

/**
 * POST /api/sync/import `{ dolar, crypto: { transactions, coins } }` → `ImportResult`.
 * Sube las operaciones locales; las que ya existen en la nube se saltean (la nube manda).
 */
export async function POST(request: Request) {
  try {
    const userId = await requireUserId()
    const input = await parseBody(request, importSchema)
    return Response.json(await importLocalData(userId, input))
  } catch (error) {
    return errorResponse(error)
  }
}
