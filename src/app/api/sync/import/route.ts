import { requireScope } from '@/server/scope'
import { errorResponse, parseBody } from '@/server/errors'
import { getDb } from '@/server/db'
import { importLocalData, importSchema, listOperationIds } from '@/server/import'
import { requireUserId } from '@/server/auth'
import { logEvent } from '@/server/log'

/**
 * GET /api/sync/import → `{ ids }`: ids de todas las operaciones del usuario, en cualquier
 * portafolio. El cliente los usa para saber qué operaciones locales faltan subir.
 */
export async function GET() {
  try {
    const userId = await requireUserId()
    return Response.json({ ids: await listOperationIds(getDb(), userId) })
  } catch (error) {
    return errorResponse(error)
  }
}

/**
 * POST /api/sync/import `{ dolar, crypto: { transactions, coins }, pesos?, cedears? }` → `ImportResult`.
 * Sube las operaciones locales al portafolio del header; las que ya existen en la nube (en
 * cualquier portafolio) se saltean (la nube manda).
 */
export async function POST(request: Request) {
  try {
    const scope = await requireScope(request)
    const input = await parseBody(request, importSchema)
    const result = await importLocalData(scope, input)
    logEvent('sync.imported', {
      ...scope,
      dolarCreated: result.dolar.created,
      dolarSkipped: result.dolar.skipped,
      cryptoCreated: result.crypto.created,
      cryptoSkipped: result.crypto.skipped,
      pesosCreated: result.pesos.created,
      pesosSkipped: result.pesos.skipped,
      cedearsCreated: result.cedears.created,
      cedearsSkipped: result.cedears.skipped,
    })
    return Response.json(result)
  } catch (error) {
    return errorResponse(error)
  }
}
