import { z } from 'zod'
import { PORTFOLIO_HEADER } from '@/lib/portfolio-scope'
import { requireUserId } from './auth'
import { getDb } from './db'
import { ApiError } from './errors'
import { ensureDefaultPortfolio } from './portfolios'

/**
 * Alcance de una operación de datos: el usuario de la sesión y uno de **sus** portafolios. Los
 * servicios filtran y escriben siempre con los dos campos, así que una operación de otro
 * portafolio (o de otro usuario) es, para este, inexistente (404).
 */
export type Scope = { userId: string; portfolioId: string }

export const PORTFOLIO_NOT_FOUND = 'El portafolio no existe.'

/**
 * `requireUserId` + el portafolio de `PORTFOLIO_HEADER`. Sin header (cliente anterior a los
 * portafolios), el principal del usuario, que se crea si todavía no tiene ninguno.
 */
export const requireScope = async (request: Request): Promise<Scope> => {
  const userId = await requireUserId()
  const header = request.headers.get(PORTFOLIO_HEADER)
  if (!header) return { userId, portfolioId: (await ensureDefaultPortfolio(userId)).id }

  if (!z.uuid().safeParse(header).success) throw new ApiError(404, PORTFOLIO_NOT_FOUND)
  const portfolio = await getDb().portfolio.findFirst({ where: { id: header, userId } })
  if (!portfolio) throw new ApiError(404, PORTFOLIO_NOT_FOUND)
  return { userId, portfolioId: portfolio.id }
}
