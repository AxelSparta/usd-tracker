import { Prisma } from '@/generated/prisma/client'

/**
 * Base en memoria con el subconjunto de Prisma que usan los servicios. Guarda los
 * montos como `Decimal` (como Postgres) para ejercitar también los mappers.
 */

type Row = Record<string, unknown> & { id: string; userId: string; date: Date }

const DECIMAL_FIELDS = ['dollarsAmount', 'pesosAmount', 'quantity', 'priceUsd', 'feeAmount']

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

type Where = { id?: string | { in: string[] }; userId?: string }

const matches = (row: Row, where: Where) =>
  (where.userId === undefined || row.userId === where.userId) &&
  (where.id === undefined ||
    (typeof where.id === 'string' ? row.id === where.id : where.id.in.includes(row.id)))

const table = (rows: Row[]) => ({
  findMany: async ({ where }: { where: Where }) =>
    rows.filter((r) => matches(r, where)).sort((a, b) => a.date.getTime() - b.date.getTime()),
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
  const db = {
    dolarRows: [] as Row[],
    cryptoRows: [] as Row[],
    users,
    user: {
      upsert: async ({ where }: { where: { id: string } }) => {
        users.add(where.id)
        return { id: where.id }
      },
    },
  }
  return {
    ...db,
    dolarTransaction: table(db.dolarRows),
    cryptoTransaction: table(db.cryptoRows),
  }
}

export type FakeDb = ReturnType<typeof createFakeDb>
