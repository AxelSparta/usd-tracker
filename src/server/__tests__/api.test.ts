import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeDb, type FakeDb } from './fake-db'

// Sesión de Clerk y base de datos simuladas: se prueban los route handlers reales
// (validación, ownership, línea temporal, mappers) sin Postgres.
const session = vi.hoisted(() => ({ userId: 'user_a' as string | null }))
const fake = vi.hoisted(() => ({ db: null as unknown }))
const log = vi.hoisted(() => ({ logEvent: vi.fn(), logError: vi.fn() }))

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

vi.mock('@/server/log', () => log)

const dolar = await import('@/app/api/dolar/transactions/route')
const dolarById = await import('@/app/api/dolar/transactions/[id]/route')
const crypto = await import('@/app/api/crypto/transactions/route')
const cryptoById = await import('@/app/api/crypto/transactions/[id]/route')
const swaps = await import('@/app/api/crypto/swaps/route')

const json = (body: unknown) =>
  new Request('http://localhost/api', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

const ID = {
  buy: '00000000-0000-4000-8000-000000000001',
  sell: '00000000-0000-4000-8000-000000000002',
  other: '00000000-0000-4000-8000-000000000003',
  swap: '00000000-0000-4000-8000-000000000004',
  swapBuy: '00000000-0000-4000-8000-000000000005',
}

const dolarTx = (id: string, type: 'BUY' | 'SELL', dollarsAmount: number, date: string) => ({
  id,
  type,
  dollarsAmount,
  pesosAmount: dollarsAmount * 1200,
  date,
  dolarOption: 'blue',
})

let db: FakeDb

beforeEach(() => {
  db = createFakeDb()
  fake.db = db
  session.userId = 'user_a'
  log.logEvent.mockClear()
  log.logError.mockClear()
})

describe('/api/dolar/transactions', () => {
  it('401 sin sesión', async () => {
    session.userId = null
    const response = await dolar.GET()
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Iniciá sesión para sincronizar tus datos.' })
  })

  it('crea, lista y devuelve montos numéricos', async () => {
    const created = await dolar.POST(json(dolarTx(ID.buy, 'BUY', 100.5, '2026-01-01T03:00:00.000Z')))
    expect(created.status).toBe(201)
    expect(await created.json()).toMatchObject({ id: ID.buy, dollarsAmount: 100.5 })

    const list = await (await dolar.GET()).json()
    expect(list).toEqual([
      {
        id: ID.buy,
        type: 'BUY',
        dollarsAmount: 100.5,
        pesosAmount: 120600,
        date: '2026-01-01T03:00:00.000Z',
        dolarOption: 'blue',
      },
    ])
    expect(db.users.has('user_a')).toBe(true)
  })

  it('400 con el mensaje de Zod', async () => {
    const response = await dolar.POST(json({ ...dolarTx(ID.buy, 'BUY', 0, '2026-01-01'), dollarsAmount: 0 }))
    expect(response.status).toBe(400)
    expect((await response.json()).error).toBe('La cantidad de dólares debe ser mayor a cero')
  })

  it('400 con fecha futura', async () => {
    const response = await dolar.POST(json(dolarTx(ID.buy, 'BUY', 1, '2999-01-01')))
    expect(response.status).toBe(400)
  })

  it('422 con el mismo mensaje que en local si el saldo queda negativo', async () => {
    const response = await dolar.POST(json(dolarTx(ID.sell, 'SELL', 1, '2026-01-01T03:00:00.000Z')))
    expect(response.status).toBe(422)
    expect((await response.json()).error).toBe('El saldo de USD quedaría negativo el 01/01/2026.')
    expect(db.dolarRows).toHaveLength(0)
  })

  it('409 si el id ya existe', async () => {
    await dolar.POST(json(dolarTx(ID.buy, 'BUY', 1, '2026-01-01')))
    const response = await dolar.POST(json(dolarTx(ID.buy, 'BUY', 1, '2026-01-01')))
    expect(response.status).toBe(409)
  })

  it('edita y borra, revalidando la línea temporal', async () => {
    await dolar.POST(json(dolarTx(ID.buy, 'BUY', 100, '2026-01-01T03:00:00.000Z')))
    await dolar.POST(json(dolarTx(ID.sell, 'SELL', 100, '2026-02-01T03:00:00.000Z')))

    const { id, ...smaller } = dolarTx(ID.buy, 'BUY', 50, '2026-01-01T03:00:00.000Z')
    const rejected = await dolarById.PATCH(json(smaller), ctx(ID.buy))
    expect(rejected.status).toBe(422)

    const { id: id2, ...bigger } = dolarTx(ID.buy, 'BUY', 150, '2026-01-01T03:00:00.000Z')
    const updated = await dolarById.PATCH(json(bigger), ctx(ID.buy))
    expect(updated.status).toBe(200)
    expect((await updated.json()).dollarsAmount).toBe(150)

    expect((await dolarById.DELETE(json({}), ctx(ID.buy))).status).toBe(422)
    expect((await dolarById.DELETE(json({}), ctx(ID.sell))).status).toBe(204)
    expect(db.dolarRows.map((r) => r.id)).toEqual([ID.buy])
  })

  it('un usuario no ve ni toca operaciones de otro (404)', async () => {
    await dolar.POST(json(dolarTx(ID.buy, 'BUY', 100, '2026-01-01')))
    session.userId = 'user_b'

    expect(await (await dolar.GET()).json()).toEqual([])
    const { id, ...data } = dolarTx(ID.buy, 'BUY', 1, '2026-01-01')
    expect((await dolarById.PATCH(json(data), ctx(ID.buy))).status).toBe(404)
    expect((await dolarById.DELETE(json({}), ctx(ID.buy))).status).toBe(404)
    // Reusar el id de otro usuario choca con la PK, sin revelar sus datos
    expect((await dolar.POST(json(dolarTx(ID.buy, 'BUY', 1, '2026-01-01')))).status).toBe(409)
    expect(db.dolarRows[0]).toMatchObject({ userId: 'user_a' })
  })

  it('404 si el id de la URL no es un UUID', async () => {
    expect((await dolarById.DELETE(json({}), ctx('no-es-uuid'))).status).toBe(404)
  })
})

describe('logs', () => {
  it('registra el alta exitosa sin montos y no registra los rechazos', async () => {
    await dolar.POST(json(dolarTx(ID.buy, 'BUY', 100, '2026-01-01T03:00:00.000Z')))
    await dolar.POST(json(dolarTx(ID.sell, 'SELL', 500, '2026-01-02T03:00:00.000Z')))
    expect(log.logEvent).toHaveBeenCalledTimes(1)
    expect(log.logEvent).toHaveBeenCalledWith('dolar.created', {
      userId: 'user_a',
      type: 'BUY',
      dolarOption: 'blue',
    })
    expect(log.logError).not.toHaveBeenCalled()
  })

  it('un error inesperado es 500 genérico y queda registrado', async () => {
    db.dolarTransaction.findMany = () => Promise.reject(new Error('conexión caída'))
    const response = await dolar.GET()
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Error inesperado del servidor.' })
    expect(log.logError).toHaveBeenCalledWith('api.unexpected', expect.any(Error))
  })
})

describe('/api/crypto/*', () => {
  const btc = { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', image: 'https://img/btc.png' }
  const eth = { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', image: null }
  const buyBtc = {
    transaction: {
      id: ID.buy,
      coinId: 'bitcoin',
      type: 'BUY',
      quantity: 1,
      priceUsd: 50_000,
      date: '2026-01-01T03:00:00.000Z',
      fee: { amount: 10, currency: 'USD' },
    },
    coin: btc,
  }

  it('crea con comisión y lista operaciones + monedas', async () => {
    expect((await crypto.POST(json(buyBtc))).status).toBe(201)
    const { transactions, coins } = await (await crypto.GET()).json()
    expect(transactions).toEqual([{ ...buyBtc.transaction }])
    expect(coins).toEqual({ bitcoin: btc })
  })

  it('400 si la moneda no coincide con la operación', async () => {
    const response = await crypto.POST(json({ ...buyBtc, coin: eth }))
    expect(response.status).toBe(400)
    expect((await response.json()).error).toBe('La moneda no coincide con la operación')
  })

  it('422 al vender sin saldo', async () => {
    const sell = { ...buyBtc, transaction: { ...buyBtc.transaction, type: 'SELL', fee: undefined } }
    const response = await crypto.POST(json(sell))
    expect(response.status).toBe(422)
    expect((await response.json()).error).toBe('No tenés suficiente BTC para vender el 01/01/2026.')
  })

  it('editar sin fee quita la comisión', async () => {
    await crypto.POST(json(buyBtc))
    const { id, fee, ...rest } = buyBtc.transaction
    const response = await cryptoById.PATCH(json({ transaction: rest, coin: btc }), ctx(ID.buy))
    expect(response.status).toBe(200)
    expect(await response.json()).not.toHaveProperty('fee')
  })

  it('intercambio: crea dos patas y se borran juntas', async () => {
    await crypto.POST(json(buyBtc))
    const response = await swaps.POST(
      json({
        swap: {
          from: btc,
          fromQuantity: 0.5,
          to: eth,
          toQuantity: 10,
          valueUsd: 30_000,
          date: '2026-02-01T03:00:00.000Z',
        },
        ids: { swapId: ID.swap, sellId: ID.sell, buyId: ID.swapBuy },
      }),
    )
    expect(response.status).toBe(201)
    expect(db.cryptoRows).toHaveLength(3)

    // Editar una pata está prohibido
    const { transactions } = await (await crypto.GET()).json()
    const { id, ...leg } = transactions.find((t: { id: string }) => t.id === ID.swapBuy)
    expect((await cryptoById.PATCH(json({ transaction: leg, coin: eth }), ctx(ID.swapBuy))).status).toBe(422)

    const removed = await cryptoById.DELETE(json({}), ctx(ID.swapBuy))
    expect((await removed.json()).removedIds.sort()).toEqual([ID.sell, ID.swapBuy])
    expect(db.cryptoRows.map((r) => r.id)).toEqual([ID.buy])
  })

  it('ownership también en cripto', async () => {
    await crypto.POST(json(buyBtc))
    session.userId = 'user_b'
    expect((await (await crypto.GET()).json()).transactions).toEqual([])
    expect((await cryptoById.DELETE(json({}), ctx(ID.buy))).status).toBe(404)
  })
})
