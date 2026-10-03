import { PrismaNeon } from '@prisma/adapter-neon'
import { Prisma, PrismaClient } from '@/generated/prisma/client'

/**
 * Cliente de Prisma (solo server). Usa el driver serverless de Neon (WebSocket sobre
 * 443, con el `WebSocket` nativo de Node) contra `DATABASE_URL`, la conexión con pooler.
 * Se crea al primer uso para que `next build` compile sin variables de entorno, y se
 * reutiliza entre recargas de dev (Turbopack reevalúa los módulos).
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const getDb = (): PrismaClient => {
  if (!globalForPrisma.prisma) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) throw new Error('Falta la variable DATABASE_URL.')
    globalForPrisma.prisma = new PrismaClient({
      adapter: new PrismaNeon({ connectionString }),
    })
  }
  return globalForPrisma.prisma
}

/** Cliente dentro de `$transaction` (mismo API de modelos) */
export type DbTransaction = Prisma.TransactionClient

/**
 * Transacción serializable: las escrituras validan la línea temporal leyendo las
 * operaciones del usuario, así que dos escrituras en paralelo no pueden pasar ambas
 * con datos viejos (la segunda falla con P2034 → 409).
 */
export const withUserTransaction = <T>(
  userId: string,
  run: (db: DbTransaction) => Promise<T>,
): Promise<T> =>
  getDb().$transaction(
    async (db) => {
      // La fila del usuario se crea en su primera escritura (no hace falta webhook)
      await db.user.upsert({ where: { id: userId }, create: { id: userId }, update: {} })
      return run(db)
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
