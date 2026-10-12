import { z } from 'zod'

export const PORTFOLIO_NAME_MAX = 40

export const portfolioNameSchema = z
  .string()
  .trim()
  .min(1, 'Poné un nombre.')
  .max(PORTFOLIO_NAME_MAX, `Hasta ${PORTFOLIO_NAME_MAX} caracteres.`)

export const createPortfolioApiSchema = z.object({
  id: z.uuid('Id inválido'),
  name: portfolioNameSchema,
})

export const renamePortfolioApiSchema = z.object({ name: portfolioNameSchema })
