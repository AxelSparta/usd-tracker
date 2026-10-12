import type { Portfolio } from '@/features/portfolios/types'
import { getDb, withUserTransaction } from './db'
import { ApiError } from './errors'

/**
 * Portafolios del usuario. Cada uno agrupa sus operaciones de los cuatro módulos; borrarlo borra
 * sus operaciones (cascade). Siempre queda al menos uno: el primero se crea solo ("Principal").
 */

export const DEFAULT_PORTFOLIO_NAME = 'Principal'

const NOT_FOUND = 'El portafolio no existe.'

type Row = { id: string; name: string; createdAt: Date }

const toPortfolio = ({ id, name }: Row): Portfolio => ({ id, name })

const byCreation = { createdAt: 'asc' } as const

/** El portafolio más viejo del usuario; si no tiene ninguno (usuario nuevo), lo crea */
export const ensureDefaultPortfolio = async (userId: string): Promise<Portfolio> => {
  const first = await getDb().portfolio.findFirst({ where: { userId }, orderBy: byCreation })
  if (first) return toPortfolio(first)
  // Serializable: dos pedidos en paralelo del primer acceso no crean dos "Principal"
  return withUserTransaction(userId, async (db) => {
    const existing = await db.portfolio.findFirst({ where: { userId }, orderBy: byCreation })
    if (existing) return toPortfolio(existing)
    return toPortfolio(
      await db.portfolio.create({
        data: { id: crypto.randomUUID(), userId, name: DEFAULT_PORTFOLIO_NAME },
      }),
    )
  })
}

/** En orden de creación (el principal primero) */
export const listPortfolios = async (userId: string): Promise<Portfolio[]> => {
  await ensureDefaultPortfolio(userId)
  return (await getDb().portfolio.findMany({ where: { userId }, orderBy: byCreation })).map(
    toPortfolio,
  )
}

export const createPortfolio = (userId: string, portfolio: Portfolio) =>
  withUserTransaction(userId, async (db) =>
    toPortfolio(await db.portfolio.create({ data: { ...portfolio, userId } })),
  )

export const renamePortfolio = (userId: string, id: string, name: string) =>
  withUserTransaction(userId, async (db) => {
    const existing = await db.portfolio.findFirst({ where: { id, userId } })
    if (!existing) throw new ApiError(404, NOT_FOUND)
    return toPortfolio(await db.portfolio.update({ where: { id, userId }, data: { name } }))
  })

/** Borra el portafolio y todas sus operaciones */
export const removePortfolio = (userId: string, id: string) =>
  withUserTransaction(userId, async (db) => {
    const all = await db.portfolio.findMany({ where: { userId }, orderBy: byCreation })
    if (!all.some((p) => p.id === id)) throw new ApiError(404, NOT_FOUND)
    if (all.length === 1) throw new ApiError(422, 'No podés borrar tu único portafolio.')
    await db.portfolio.delete({ where: { id, userId } })
  })
