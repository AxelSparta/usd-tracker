import { createPortfolioApiSchema } from '@/features/portfolios/validations'
import { requireUserId } from '@/server/auth'
import { errorResponse, parseBody } from '@/server/errors'
import { logEvent } from '@/server/log'
import { createPortfolio, listPortfolios } from '@/server/portfolios'

/** GET /api/portfolios → `Portfolio[]` (en orden de creación; crea el principal si no hay) */
export async function GET() {
  try {
    const userId = await requireUserId()
    return Response.json(await listPortfolios(userId))
  } catch (error) {
    return errorResponse(error)
  }
}

/** POST /api/portfolios `{ id, name }` (id generado por el cliente) → 201 `Portfolio` */
export async function POST(request: Request) {
  try {
    const userId = await requireUserId()
    const input = await parseBody(request, createPortfolioApiSchema)
    const created = await createPortfolio(userId, input)
    logEvent('portfolio.created', { userId, portfolioId: created.id })
    return Response.json(created, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
