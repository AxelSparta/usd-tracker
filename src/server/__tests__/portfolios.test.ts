import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeDb, type FakeDb } from './fake-db'

// Múltiples portafolios: cada operación vive en uno; el server filtra por (usuario, portafolio)
const session = vi.hoisted(() => ({ userId: 'user_a' as string | null }))
const fake = vi.hoisted(() => ({ db: null as unknown }))

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: session.userId }),
}))
vi.mock('@/server/db', () => ({
  getDb: () => fake.db,
  withUserTransaction: async (userId: string, run: (db: unknown) => Promise<unknown>) => {
    await (fake.db as FakeDb).user.upsert({ where: { id: userId } })
    return run(fake.db)
  },
}))
vi.mock('@/server/log', () => ({ logEvent: vi.fn(), logError: vi.fn() }))

const portfolios = await import('@/app/api/portfolios/route')
const portfolioById = await import('@/app/api/portfolios/[id]/route')
const dolar = await import('@/app/api/dolar/transactions/route')
const syncImport = await import('@/app/api/sync/import/route')

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const A = uuid(901)
const B = uuid(902)

const request = (method: string, portfolioId?: string, body?: unknown) =>
  new Request('http://localhost/api', {
    method,
    headers: portfolioId ? { 'x-portfolio-id': portfolioId } : {},
    ...(body !== undefined && { body: JSON.stringify(body) }),
  })
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

const dolarTx = (n: number, type: 'BUY' | 'SELL', dollarsAmount: number, date: string) => ({
  id: uuid(n),
  type,
  dollarsAmount,
  pesosAmount: dollarsAmount * 1000,
  date,
  dolarOption: 'blue',
})

let db: FakeDb
beforeEach(() => {
  db = createFakeDb()
  fake.db = db
  session.userId = 'user_a'
})

const createAB = async () => {
  await portfolios.POST(request('POST', undefined, { id: A, name: 'Largo plazo' }))
  await portfolios.POST(request('POST', undefined, { id: B, name: 'Trading' }))
}

describe('/api/portfolios', () => {
  it('un usuario nuevo recibe su "Principal", una sola vez', async () => {
    const first = await (await portfolios.GET()).json()
    expect(first).toEqual([{ id: expect.any(String), name: 'Principal' }])
    expect(await (await portfolios.GET()).json()).toEqual(first)
  })

  it('crea, renombra y lista en orden de creación', async () => {
    await createAB()
    const renamed = await portfolioById.PATCH(request('PATCH', undefined, { name: '  Ahorro ' }), ctx(B))
    expect(await renamed.json()).toEqual({ id: B, name: 'Ahorro' })
    // Ya tiene portafolios: no se crea el principal
    expect(await (await portfolios.GET()).json()).toEqual([
      { id: A, name: 'Largo plazo' },
      { id: B, name: 'Ahorro' },
    ])
  })

  it('valida el nombre (400) y el id (409 si se repite)', async () => {
    expect((await portfolios.POST(request('POST', undefined, { id: A, name: ' ' }))).status).toBe(400)
    await portfolios.POST(request('POST', undefined, { id: A, name: 'Uno' }))
    expect((await portfolios.POST(request('POST', undefined, { id: A, name: 'Dos' }))).status).toBe(409)
  })

  it('borrar un portafolio borra sus operaciones; el último no se borra', async () => {
    await createAB()
    await dolar.POST(request('POST', B, dolarTx(1, 'BUY', 100, '2026-01-01T03:00:00.000Z')))
    expect((await portfolioById.DELETE(request('DELETE'), ctx(B))).status).toBe(204)
    expect(db.dolarRows).toEqual([])

    const last = await portfolioById.DELETE(request('DELETE'), ctx(A))
    expect(last.status).toBe(422)
    expect((await last.json()).error).toBe('No podés borrar tu único portafolio.')
  })

  it('no se ve ni se toca el portafolio de otro usuario (404)', async () => {
    await createAB()
    session.userId = 'user_b'
    expect((await portfolioById.PATCH(request('PATCH', undefined, { name: 'X' }), ctx(A))).status).toBe(404)
    expect((await portfolioById.DELETE(request('DELETE'), ctx(A))).status).toBe(404)
    expect((await dolar.GET(request('GET', A))).status).toBe(404)
    expect((await dolar.GET(request('GET', 'no-es-uuid'))).status).toBe(404)
  })
})

describe('operaciones por portafolio', () => {
  it('cada portafolio lista y valida solo lo suyo', async () => {
    await createAB()
    await dolar.POST(request('POST', A, dolarTx(1, 'BUY', 100, '2026-01-01T03:00:00.000Z')))

    expect(await (await dolar.GET(request('GET', B))).json()).toEqual([])
    expect(await (await dolar.GET(request('GET', A))).json()).toHaveLength(1)

    // B no tiene dólares: la venta no se valida contra el saldo de A
    const sell = await dolar.POST(request('POST', B, dolarTx(2, 'SELL', 50, '2026-02-01T03:00:00.000Z')))
    expect(sell.status).toBe(422)
    expect(db.dolarRows).toHaveLength(1)
  })

  it('sin header se usa el portafolio más viejo (clientes anteriores)', async () => {
    await createAB()
    await dolar.POST(request('POST', undefined, dolarTx(1, 'BUY', 100, '2026-01-01T03:00:00.000Z')))
    expect(db.dolarRows[0]).toMatchObject({ portfolioId: A })
  })

  it('la importación va al portafolio del header y saltea ids que ya están en otro', async () => {
    await createAB()
    const buy = dolarTx(1, 'BUY', 100, '2026-01-01T03:00:00.000Z')
    await dolar.POST(request('POST', A, buy))

    const payload = {
      dolar: [buy, dolarTx(2, 'BUY', 10, '2026-01-02T03:00:00.000Z')],
      crypto: { transactions: [], coins: {} },
    }
    const result = await (await syncImport.POST(request('POST', B, payload))).json()
    expect(result.dolar).toEqual({ created: 1, skipped: 1 })
    expect(db.dolarRows.map((r) => [r.id, r.portfolioId])).toEqual([
      [uuid(1), A],
      [uuid(2), B],
    ])
    expect((await (await syncImport.GET()).json()).ids.sort()).toEqual([uuid(1), uuid(2)])
  })
})
