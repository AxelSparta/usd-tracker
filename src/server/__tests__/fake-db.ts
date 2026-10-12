import { Prisma } from '@/generated/prisma/client'

/**
 * Base en memoria con el subconjunto de Prisma que usan los servicios. Guarda los
 * montos como `Decimal` (como Postgres) para ejercitar también los mappers.
 */

type Row = Record<string, unknown> & { id: string; userId: string; date?: Date; createdAt?: Date }

const DECIMAL_FIELDS = ['dollarsAmount', 'pesosAmount', 'quantity', 'priceUsd', 'feeAmount', 'amount', 'price', 'fxRate', 'fee']

const toRow = (data: Record<string, unknown>): Row => {
  const row: Record<string, unknown> = { createdAt: new Date(), updatedAt: new Date(), ...data }
  for (const field of DECIMAL_FIELDS) {
    if (typeof row[field] === 'number') row[field] = new Prisma.Decimal(row[field] as number)
  }
  return row as Row
}

const duplicate = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'fake',
  })

/** `id` (o `{ in }`) y cualquier otro campo por igualdad (`userId`, `portfolioId`) */
type Where = { id?: string | { in: string[] } } & Record<string, unknown>

const matches = (row: Row, { id, ...fields }: Where) =>
  Object.entries(fields).every(([key, value]) => value === undefined || row[key] === value) &&
  (id === undefined || (typeof id === 'string' ? row.id === id : id.in.includes(row.id)))

// Operaciones por fecha; portafolios por creación
const time = (row: Row) => (row.date ?? row.createdAt)!.getTime()

const table = (rows: Row[]) => ({
  findMany: async ({ where }: { where: Where }) =>
    rows.filter((r) => matches(r, where)).sort((a, b) => time(a) - time(b)),
  findFirst: async ({ where }: { where: Where }) =>
    rows.filter((r) => matches(r, where)).sort((a, b) => time(a) - time(b))[0] ?? null,
  create: async ({ data }: { data: Record<string, unknown> }) => {
    if (rows.some((r) => r.id === data.id)) throw duplicate()
    const row = toRow(data)
    rows.push(row)
    return row
  },
  createMany: async ({
    data,
    skipDuplicates,
  }: {
    data: Record<string, unknown>[]
    skipDuplicates?: boolean
  }) => {
    const exists = (d: Record<string, unknown>) => rows.some((r) => r.id === d.id)
    if (!skipDuplicates && data.some(exists)) throw duplicate()
    const fresh = data.filter((d) => !exists(d))
    rows.push(...fresh.map(toRow))
    return { count: fresh.length }
  },
  update: async ({ where, data }: { where: Where; data: Record<string, unknown> }) => {
    const index = rows.findIndex((r) => matches(r, where))
    if (index === -1) throw new Error('Record to update not found')
    rows[index] = toRow({ ...rows[index], ...data })
    return rows[index]
  },
  delete: async ({ where }: { where: Where }) => {
    const index = rows.findIndex((r) => matches(r, where))
    if (index === -1) throw new Error('Record to delete not found')
    return rows.splice(index, 1)[0]
  },
  deleteMany: async ({ where }: { where: Where }) => {
    const before = rows.length
    for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i], where)) rows.splice(i, 1)
    return { count: before - rows.length }
  },
})

export const createFakeDb = () => {
  const users = new Set<string>()
  // Creación estrictamente creciente: el orden de los portafolios no depende del reloj
  let clock = 0
  const db = {
    portfolioRows: [] as Row[],
    dolarRows: [] as Row[],
    cryptoRows: [] as Row[],
    pesosRows: [] as Row[],
    cedearRows: [] as Row[],
    users,
    user: {
      upsert: async ({ where }: { where: { id: string } }) => {
        users.add(where.id)
        return { id: where.id }
      },
    },
  }
  const operations = [db.dolarRows, db.cryptoRows, db.pesosRows, db.cedearRows]
  const portfolios = table(db.portfolioRows)
  return {
    ...db,
    portfolio: {
      ...portfolios,
      create: ({ data }: { data: Record<string, unknown> }) =>
        portfolios.create({ data: { createdAt: new Date(++clock), ...data } }),
      // Cascade: las operaciones del portafolio se van con él
      delete: async ({ where }: { where: Where }) => {
        const removed = await portfolios.delete({ where })
        for (const rows of operations) {
          for (let i = rows.length - 1; i >= 0; i--) {
            if (rows[i].portfolioId === removed.id) rows.splice(i, 1)
          }
        }
        return removed
      },
    },
    dolarTransaction: table(db.dolarRows),
    cryptoTransaction: table(db.cryptoRows),
    pesosMovement: table(db.pesosRows),
    cedearTransaction: table(db.cedearRows),
  }
}

export type FakeDb = ReturnType<typeof createFakeDb>
