import { renamePortfolioApiSchema } from '@/features/portfolios/validations'
import { requireUserId } from '@/server/auth'
import { ApiError, errorResponse, parseBody, parseIdParam } from '@/server/errors'
import { logEvent } from '@/server/log'
import { removePortfolio, renamePortfolio } from '@/server/portfolios'
import { PORTFOLIO_NOT_FOUND } from '@/server/scope'

type Context = { params: Promise<{ id: string }> }

const portfolioId = (params: Context['params']) =>
  parseIdParam(params).catch(() => {
    throw new ApiError(404, PORTFOLIO_NOT_FOUND)
  })

/** PATCH /api/portfolios/:id `{ name }` → `Portfolio` */
export async function PATCH(request: Request, { params }: Context) {
  try {
    const userId = await requireUserId()
    const id = await portfolioId(params)
    const { name } = await parseBody(request, renamePortfolioApiSchema)
    const updated = await renamePortfolio(userId, id, name)
    logEvent('portfolio.renamed', { userId, portfolioId: id })
    return Response.json(updated)
  } catch (error) {
    return errorResponse(error)
  }
}

/** DELETE /api/portfolios/:id → 204 (borra también todas sus operaciones; nunca el último) */
export async function DELETE(_request: Request, { params }: Context) {
  try {
    const userId = await requireUserId()
    const id = await portfolioId(params)
    await removePortfolio(userId, id)
    logEvent('portfolio.removed', { userId, portfolioId: id })
    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
