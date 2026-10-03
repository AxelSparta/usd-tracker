import { requireUserId } from '@/server/auth'
import { errorResponse, parseBody } from '@/server/errors'
import { importLocalData, importSchema } from '@/server/import'
import { logEvent } from '@/server/log'

/**
 * POST /api/sync/import `{ dolar, crypto: { transactions, coins } }` → `ImportResult`.
 * Sube las operaciones locales; las que ya existen en la nube se saltean (la nube manda).
 */
export async function POST(request: Request) {
  try {
    const userId = await requireUserId()
    const input = await parseBody(request, importSchema)
    const result = await importLocalData(userId, input)
    logEvent('sync.imported', {
      userId,
      dolarCreated: result.dolar.created,
      dolarSkipped: result.dolar.skipped,
      cryptoCreated: result.crypto.created,
      cryptoSkipped: result.crypto.skipped,
    })
    return Response.json(result)
  } catch (error) {
    return errorResponse(error)
  }
}
