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
const usdtSwaps = await import('@/app/api/usdt-swaps/route')
const usdtSwapById = await import('@/app/api/usdt-swaps/[id]/route')
const pesos = await import('@/app/api/pesos/movements/route')
const pesosById = await import('@/app/api/pesos/movements/[id]/route')
const conversions = await import('@/app/api/pesos/conversions/route')
const conversionById = await import('@/app/api/pesos/conversions/[id]/route')
const cedears = await import('@/app/api/cedears/transactions/route')
const cedearById = await import('@/app/api/cedears/transactions/[id]/route')

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
  usdtSwap: '00000000-0000-4000-8000-000000000006',
  usdtLeg: '00000000-0000-4000-8000-000000000007',
  coinLeg: '00000000-0000-4000-8000-000000000008',
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

describe('/api/usdt-swaps', () => {
  const btc = { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', image: null }
  const usdtBuy = { ...dolarTx(ID.buy, 'BUY', 1000, '2026-01-01T03:00:00.000Z'), dolarOption: 'cripto' }
  const body = {
    swap: {
      direction: 'USDT_TO_COIN',
      coin: btc,
      quantity: 0.01,
      usdt: 600,
      fee: { amount: 0.6, currency: 'USDT' },
      arsRate: 1500,
      date: '2026-02-01T03:00:00.000Z',
    },
    ids: { usdtSwapId: ID.usdtSwap, dolarId: ID.usdtLeg, cryptoId: ID.coinLeg },
  }

  it('crea las dos patas en una sola escritura y las lista cada módulo', async () => {
    await dolar.POST(json(usdtBuy))
    const response = await usdtSwaps.POST(json(body))
    expect(response.status).toBe(201)

    const dolarList = await (await dolar.GET()).json()
    expect(dolarList.find((t: { id: string }) => t.id === ID.usdtLeg)).toMatchObject({
      type: 'SELL',
      dollarsAmount: 600.6,
      pesosAmount: 900_900,
      dolarOption: 'cripto',
      usdtSwapId: ID.usdtSwap,
    })
    const { transactions, coins } = await (await crypto.GET()).json()
    expect(transactions).toEqual([
      expect.objectContaining({ id: ID.coinLeg, type: 'BUY', quantity: 0.01, usdtSwapId: ID.usdtSwap }),
    ])
    expect(coins).toEqual({ bitcoin: btc })
    expect(log.logEvent).toHaveBeenCalledWith('usdtSwap.created', expect.not.objectContaining({ usdt: 600 }))
  })

  it('422 sin USDT suficientes, y no escribe ninguna pata', async () => {
    const response = await usdtSwaps.POST(json(body))
    expect(response.status).toBe(422)
    expect((await response.json()).error).toBe('No tenés suficientes USDT el 01/02/2026.')
    expect(db.dolarRows).toHaveLength(0)
    expect(db.cryptoRows).toHaveLength(0)
  })

  it('400 con datos inválidos', async () => {
    const response = await usdtSwaps.POST(json({ ...body, swap: { ...body.swap, usdt: -1 } }))
    expect(response.status).toBe(400)
  })

  it('una pata no se edita ni se borra sola; el intercambio se borra completo', async () => {
    await dolar.POST(json(usdtBuy))
    await usdtSwaps.POST(json(body))

    const legEdit = await dolarById.PATCH(json({ ...usdtBuy, id: undefined }), ctx(ID.usdtLeg))
    expect(legEdit.status).toBe(422)
    expect((await legEdit.json()).error).toBe('Los intercambios con USDT no se editan: borralo y cargalo de nuevo.')
    expect((await dolarById.DELETE(json({}), ctx(ID.usdtLeg))).status).toBe(422)
    expect((await cryptoById.DELETE(json({}), ctx(ID.coinLeg))).status).toBe(422)

    const removed = await usdtSwapById.DELETE(json({}), ctx(ID.usdtSwap))
    expect(removed.status).toBe(200)
    expect((await removed.json()).removedIds.sort()).toEqual([ID.usdtLeg, ID.coinLeg].sort())
    expect(db.dolarRows.map((r) => r.id)).toEqual([ID.buy])
    expect(db.cryptoRows).toHaveLength(0)
  })

  it('una operación normal no se puede convertir en pata por la API del módulo', async () => {
    await dolar.POST(json({ ...usdtBuy, usdtSwapId: ID.usdtSwap }))
    expect(db.dolarRows[0].usdtSwapId).toBeNull()
  })

  it('ownership: otro usuario no lo ve ni lo borra (404)', async () => {
    await dolar.POST(json(usdtBuy))
    await usdtSwaps.POST(json(body))
    session.userId = 'user_b'
    expect((await usdtSwapById.DELETE(json({}), ctx(ID.usdtSwap))).status).toBe(404)
    session.userId = 'user_a'
    expect(db.cryptoRows).toHaveLength(1)
  })
})

describe('resultados de trades', () => {
  const btc = { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', image: null }
  const usdtGain = {
    ...dolarTx(ID.buy, 'BUY', 50, '2026-02-01T03:00:00.000Z'),
    dolarOption: 'cripto',
    kind: 'TRADE_RESULT',
    note: 'BTCUSDT long x10',
  }

  it('en USDT: se guarda con kind y note y se lista igual', async () => {
    expect((await dolar.POST(json(usdtGain))).status).toBe(201)
    const [listed] = await (await dolar.GET()).json()
    expect(listed).toMatchObject({ kind: 'TRADE_RESULT', note: 'BTCUSDT long x10', dolarOption: 'cripto' })
  })

  it('422 fuera del dólar cripto', async () => {
    const response = await dolar.POST(json({ ...usdtGain, dolarOption: 'blue' }))
    expect(response.status).toBe(422)
    expect((await response.json()).error).toBe('Los resultados de trades en USDT van en el dólar cripto.')
  })

  it('400 con un kind desconocido', async () => {
    expect((await dolar.POST(json({ ...usdtGain, kind: 'AIRDROP' }))).status).toBe(400)
  })

  it('en otra moneda: sin comisión (422) y editable', async () => {
    const gain = {
      transaction: {
        id: ID.other,
        coinId: 'bitcoin',
        type: 'BUY',
        quantity: 0.01,
        priceUsd: 60_000,
        date: '2026-02-01T03:00:00.000Z',
        kind: 'TRADE_RESULT',
      },
      coin: btc,
    }
    const withFee = { ...gain, transaction: { ...gain.transaction, fee: { amount: 1, currency: 'USD' } } }
    expect((await crypto.POST(json(withFee))).status).toBe(422)
    expect((await crypto.POST(json(gain))).status).toBe(201)

    const { id, ...rest } = gain.transaction
    const edited = await cryptoById.PATCH(json({ transaction: { ...rest, note: 'grid bot' }, coin: btc }), ctx(id))
    expect(edited.status).toBe(200)
    expect(await edited.json()).toMatchObject({ kind: 'TRADE_RESULT', note: 'grid bot' })
  })
})

describe('/api/pesos/movements', () => {
  const pesosMovement = (id: string, type: 'BUY' | 'SELL', amount: number, date: string, extra = {}) => ({
    id,
    type,
    amount,
    date,
    ...extra,
  })

  it('401 sin sesión', async () => {
    session.userId = null
    expect((await pesos.GET()).status).toBe(401)
  })

  it('crea, lista con montos numéricos y registra el alta sin montos', async () => {
    const created = await pesos.POST(
      json(pesosMovement(ID.buy, 'BUY', 1_500_000.5, '2026-01-01T03:00:00.000Z', { note: 'Sueldo' })),
    )
    expect(created.status).toBe(201)
    expect(await (await pesos.GET()).json()).toEqual({
      movements: [
        { id: ID.buy, type: 'BUY', amount: 1_500_000.5, date: '2026-01-01T03:00:00.000Z', note: 'Sueldo' },
      ],
    })
    expect(log.logEvent).toHaveBeenCalledWith('pesos.created', { userId: 'user_a', type: 'BUY' })
  })

  it('400 con monto no positivo', async () => {
    const response = await pesos.POST(json(pesosMovement(ID.buy, 'BUY', 0, '2026-01-01')))
    expect(response.status).toBe(400)
    expect((await response.json()).error).toBe('El monto debe ser mayor a cero')
  })

  it('422 con el mismo mensaje que en local si el saldo queda negativo', async () => {
    const response = await pesos.POST(json(pesosMovement(ID.sell, 'SELL', 1, '2026-01-01T03:00:00.000Z')))
    expect(response.status).toBe(422)
    expect((await response.json()).error).toBe('No tenés pesos suficientes el 01/01/2026.')
    expect(db.pesosRows).toHaveLength(0)
  })

  it('edita (sin nota = la quita) y borra, revalidando la línea temporal', async () => {
    await pesos.POST(json(pesosMovement(ID.buy, 'BUY', 1000, '2026-01-01T03:00:00.000Z', { note: 'x' })))
    await pesos.POST(json(pesosMovement(ID.sell, 'SELL', 800, '2026-02-01T03:00:00.000Z')))

    const { id, ...smaller } = pesosMovement(ID.buy, 'BUY', 500, '2026-01-01T03:00:00.000Z')
    expect((await pesosById.PATCH(json(smaller), ctx(ID.buy))).status).toBe(422)

    const { id: id2, ...bigger } = pesosMovement(ID.buy, 'BUY', 2000, '2026-01-01T03:00:00.000Z')
    const updated = await pesosById.PATCH(json(bigger), ctx(ID.buy))
    expect(updated.status).toBe(200)
    expect(await updated.json()).toEqual({ ...bigger, id: ID.buy })

    expect((await pesosById.DELETE(json({}), ctx(ID.buy))).status).toBe(422)
    expect((await pesosById.DELETE(json({}), ctx(ID.sell))).status).toBe(204)
    expect(db.pesosRows.map((r) => r.id)).toEqual([ID.buy])
  })

  it('la API del módulo no crea patas de conversión', async () => {
    await pesos.POST(json(pesosMovement(ID.buy, 'BUY', 1000, '2026-01-01', { conversionId: ID.other })))
    expect(db.pesosRows[0].conversionId).toBeNull()
  })

  it('una pata de conversión no se edita ni se borra sola', async () => {
    await db.pesosMovement.create({
      data: { id: ID.buy, userId: 'user_a', type: 'BUY', amount: 1000, date: new Date('2026-01-01'), note: null, conversionId: ID.other },
    })
    const { id, ...data } = pesosMovement(ID.buy, 'BUY', 2000, '2026-01-01')
    expect((await pesosById.PATCH(json(data), ctx(ID.buy))).status).toBe(422)
    const removed = await pesosById.DELETE(json({}), ctx(ID.buy))
    expect(removed.status).toBe(422)
    expect((await removed.json()).error).toBe('Es una conversión con dólares: borrala completa.')
  })

  it('un usuario no ve ni toca movimientos de otro (404)', async () => {
    await pesos.POST(json(pesosMovement(ID.buy, 'BUY', 1000, '2026-01-01')))
    session.userId = 'user_b'
    expect(await (await pesos.GET()).json()).toEqual({ movements: [] })
    const { id, ...data } = pesosMovement(ID.buy, 'BUY', 1, '2026-01-01')
    expect((await pesosById.PATCH(json(data), ctx(ID.buy))).status).toBe(404)
    expect((await pesosById.DELETE(json({}), ctx(ID.buy))).status).toBe(404)
    expect((await pesos.POST(json(pesosMovement(ID.buy, 'BUY', 1, '2026-01-01')))).status).toBe(409)
  })
})

describe('/api/pesos/conversions', () => {
  const CONV = {
    conversionId: '00000000-0000-4000-8000-0000000000c1',
    pesosId: '00000000-0000-4000-8000-0000000000c2',
    dolarId: '00000000-0000-4000-8000-0000000000c3',
  }
  const income = { id: ID.buy, type: 'BUY', amount: 3_000_000, date: '2026-01-01T03:00:00.000Z' }
  const toBlue = {
    direction: 'PESOS_TO_DOLAR',
    dolarOption: 'blue',
    pesosAmount: 1_560_000,
    dollarsAmount: 1000,
    date: '2026-02-01T03:00:00.000Z',
  }

  beforeEach(async () => {
    await pesos.POST(json(income))
  })

  it('crea las dos patas en una sola escritura y cada módulo lista la suya', async () => {
    const response = await conversions.POST(json({ conversion: toBlue, ids: CONV }))
    expect(response.status).toBe(201)

    const { movements } = await (await pesos.GET()).json()
    expect(movements.find((m: { id: string }) => m.id === CONV.pesosId)).toMatchObject({
      type: 'SELL',
      amount: 1_560_000,
      conversionId: CONV.conversionId,
    })
    expect(await (await dolar.GET()).json()).toEqual([
      {
        id: CONV.dolarId,
        type: 'BUY',
        pesosAmount: 1_560_000,
        dollarsAmount: 1000,
        date: '2026-02-01T03:00:00.000Z',
        dolarOption: 'blue',
        conversionId: CONV.conversionId,
      },
    ])
    expect(log.logEvent).toHaveBeenCalledWith('pesosConversion.created', {
      userId: 'user_a',
      conversionId: CONV.conversionId,
      direction: 'PESOS_TO_DOLAR',
      dolarOption: 'blue',
    })
  })

  it('422 sin pesos o sin USD suficientes, y no escribe ninguna pata', async () => {
    const noPesos = await conversions.POST(json({ conversion: { ...toBlue, pesosAmount: 5_000_000 }, ids: CONV }))
    expect(noPesos.status).toBe(422)
    expect((await noPesos.json()).error).toBe('No tenés pesos suficientes para convertir el 01/02/2026.')

    const noUsd = await conversions.POST(json({ conversion: { ...toBlue, direction: 'DOLAR_TO_PESOS' }, ids: CONV }))
    expect(noUsd.status).toBe(422)
    expect((await noUsd.json()).error).toBe('No tenés suficientes USD Blue para convertir el 01/02/2026.')
    expect(db.pesosRows).toHaveLength(1)
    expect(db.dolarRows).toHaveLength(0)
  })

  it('400 con datos inválidos', async () => {
    const response = await conversions.POST(json({ conversion: { ...toBlue, dolarOption: 'euro' }, ids: CONV }))
    expect(response.status).toBe(400)
  })

  it('una pata no se edita ni se borra desde su módulo; la conversión se borra completa', async () => {
    await conversions.POST(json({ conversion: toBlue, ids: CONV }))

    const { id, ...dolarData } = dolarTx(CONV.dolarId, 'BUY', 1000, '2026-02-01T03:00:00.000Z')
    expect((await dolarById.PATCH(json(dolarData), ctx(CONV.dolarId))).status).toBe(422)
    const dolarRemove = await dolarById.DELETE(json({}), ctx(CONV.dolarId))
    expect(dolarRemove.status).toBe(422)
    expect((await dolarRemove.json()).error).toBe('Es una conversión de pesos: borrala completa.')
    expect((await pesosById.DELETE(json({}), ctx(CONV.pesosId))).status).toBe(422)

    const removed = await conversionById.DELETE(json({}), ctx(CONV.conversionId))
    expect(removed.status).toBe(200)
    expect((await removed.json()).removedIds.sort()).toEqual([CONV.pesosId, CONV.dolarId].sort())
    expect(db.pesosRows.map((r) => r.id)).toEqual([ID.buy])
    expect(db.dolarRows).toHaveLength(0)
  })

  it('no se borra si los USD comprados ya se vendieron', async () => {
    await conversions.POST(json({ conversion: toBlue, ids: CONV }))
    await dolar.POST(json(dolarTx(ID.sell, 'SELL', 600, '2026-03-01T03:00:00.000Z')))
    const response = await conversionById.DELETE(json({}), ctx(CONV.conversionId))
    expect(response.status).toBe(422)
    expect(db.dolarRows).toHaveLength(2)
  })

  it('la API del Dólar no crea patas de conversión', async () => {
    await dolar.POST(json({ ...dolarTx(ID.other, 'BUY', 1, '2026-01-01'), conversionId: CONV.conversionId }))
    expect(db.dolarRows[0].conversionId).toBeNull()
  })

  it('ownership: otro usuario no la ve ni la borra (404)', async () => {
    await conversions.POST(json({ conversion: toBlue, ids: CONV }))
    session.userId = 'user_b'
    expect((await conversionById.DELETE(json({}), ctx(CONV.conversionId))).status).toBe(404)
    expect(db.dolarRows).toHaveLength(1)
  })
})

describe('patas de CEDEARs (Fase 9.0)', () => {
  const CEDEAR_LEG = 'Es parte de una operación de CEDEAR: modificala desde CEDEARs.'
  const date = new Date('2026-01-01T03:00:00.000Z')

  it('una pata de pesos no se edita ni se borra desde /api/pesos', async () => {
    await db.pesosMovement.create({
      data: { id: ID.buy, userId: 'user_a', type: 'BUY', amount: 1000, date, note: null, conversionId: null, cedearId: ID.other },
    })
    const body = { type: 'BUY', amount: 2000, date: date.toISOString() }
    const updated = await pesosById.PATCH(json(body), ctx(ID.buy))
    expect(updated.status).toBe(422)
    expect((await updated.json()).error).toBe(CEDEAR_LEG)
    expect((await pesosById.DELETE(json({}), ctx(ID.buy))).status).toBe(422)
    expect(db.pesosRows).toHaveLength(1)
  })

  it('una pata de CCL no se edita ni se borra desde /api/dolar', async () => {
    await db.dolarTransaction.create({
      data: {
        ...dolarTx(ID.buy, 'BUY', 100, date.toISOString()),
        date,
        dolarOption: 'contadoconliqui',
        userId: 'user_a',
        usdtSwapId: null,
        conversionId: null,
        cedearId: ID.other,
        kind: null,
        note: null,
      },
    })
    const { id, ...body } = { ...dolarTx(ID.buy, 'BUY', 50, date.toISOString()), dolarOption: 'contadoconliqui' }
    const updated = await dolarById.PATCH(json(body), ctx(ID.buy))
    expect(updated.status).toBe(422)
    expect((await updated.json()).error).toBe(CEDEAR_LEG)
    expect((await dolarById.DELETE(json({}), ctx(ID.buy))).status).toBe(422)
    expect(db.dolarRows).toHaveLength(1)
  })

  it('las APIs de los módulos no crean patas de CEDEAR', async () => {
    await pesos.POST(json({ id: ID.buy, type: 'BUY', amount: 1000, date: date.toISOString(), cedearId: ID.other }))
    expect(db.pesosRows[0].cedearId).toBeNull()
    await dolar.POST(json({ ...dolarTx(ID.sell, 'BUY', 1, date.toISOString()), dolarOption: 'contadoconliqui', cedearId: ID.other }))
    expect(db.dolarRows[0].cedearId).toBeNull()
  })
})

describe('/api/cedears/transactions (Fase 9.3)', () => {
  const C = {
    buy: '00000000-0000-4000-8000-0000000000d1',
    buyLeg: '00000000-0000-4000-8000-0000000000d2',
    sell: '00000000-0000-4000-8000-0000000000d3',
    sellLeg: '00000000-0000-4000-8000-0000000000d4',
  }
  const income = { id: ID.buy, type: 'BUY', amount: 1_000_000, date: '2026-01-01T03:00:00.000Z' }
  const cclBuy = {
    ...dolarTx(ID.other, 'BUY', 1000, '2026-01-01T03:00:00.000Z'),
    dolarOption: 'contadoconliqui',
  }
  const buy = {
    ticker: 'aapl',
    type: 'BUY',
    quantity: 10,
    price: 20_000,
    currency: 'ARS',
    fxRate: 1250,
    fee: 1000,
    date: '2026-02-01T03:00:00.000Z',
  }

  beforeEach(async () => {
    await pesos.POST(json(income))
    await dolar.POST(json(cclBuy))
  })

  it('crea la operación y su egreso de pesos en una sola escritura', async () => {
    const response = await cedears.POST(json({ ...buy, id: C.buy, legId: C.buyLeg }))
    expect(response.status).toBe(201)
    const created = await response.json()
    expect(created.transaction).toMatchObject({ id: C.buy, ticker: 'AAPL', quantity: 10, fee: 1000 })
    expect(created.leg).toMatchObject({ module: 'pesos', leg: { id: C.buyLeg, type: 'SELL', amount: 201_000 } })

    expect((await (await cedears.GET()).json()).transactions).toHaveLength(1)
    const { movements } = await (await pesos.GET()).json()
    expect(movements.find((m: { id: string }) => m.id === C.buyLeg)).toMatchObject({
      type: 'SELL',
      amount: 201_000,
      cedearId: C.buy,
    })
    expect(log.logEvent).toHaveBeenCalledWith('cedear.created', {
      userId: 'user_a',
      id: C.buy,
      type: 'BUY',
      currency: 'ARS',
    })
  })

  it('con CCL, la pata es una venta de USD CCL', async () => {
    const body = { ...buy, currency: 'CCL', price: 16, fee: 2, id: C.buy, legId: C.buyLeg }
    expect((await cedears.POST(json(body))).status).toBe(201)
    const leg = db.dolarRows.find((r) => r.id === C.buyLeg)
    expect(leg).toMatchObject({ type: 'SELL', dolarOption: 'contadoconliqui', cedearId: C.buy })
    expect(Number(leg?.dollarsAmount)).toBe(162)
    expect(Number(leg?.pesosAmount)).toBe(162 * 1250)
  })

  it('400 con cantidad no entera o ticker inválido', async () => {
    const fraction = await cedears.POST(json({ ...buy, quantity: 1.5, id: C.buy, legId: C.buyLeg }))
    expect(fraction.status).toBe(400)
    expect((await fraction.json()).error).toBe('La cantidad debe ser un número entero de CEDEARs')
    expect((await cedears.POST(json({ ...buy, ticker: 'AA PL', id: C.buy, legId: C.buyLeg }))).status).toBe(400)
  })

  it('422 sin pesos, sin USD CCL o sin unidades, y no escribe nada', async () => {
    const noPesos = await cedears.POST(json({ ...buy, price: 200_000, id: C.buy, legId: C.buyLeg }))
    expect(noPesos.status).toBe(422)
    expect((await noPesos.json()).error).toBe('No tenés pesos suficientes el 01/02/2026.')

    const noCcl = await cedears.POST(json({ ...buy, currency: 'CCL', price: 200, id: C.buy, legId: C.buyLeg }))
    expect(noCcl.status).toBe(422)
    expect((await noCcl.json()).error).toBe('No tenés suficientes USD CCL el 01/02/2026.')

    const noUnits = await cedears.POST(json({ ...buy, type: 'SELL', id: C.sell, legId: C.sellLeg }))
    expect(noUnits.status).toBe(422)
    expect((await noUnits.json()).error).toBe('No tenés suficientes AAPL el 01/02/2026.')

    expect(db.cedearRows).toHaveLength(0)
    expect(db.pesosRows).toHaveLength(1)
    expect(db.dolarRows).toHaveLength(1)
  })

  it('al editar de ARS a CCL la pata se mueve de tabla con el mismo id', async () => {
    await cedears.POST(json({ ...buy, id: C.buy, legId: C.buyLeg }))
    const response = await cedearById.PATCH(json({ ...buy, currency: 'CCL', price: 16, fee: 0 }), ctx(C.buy))
    expect(response.status).toBe(200)
    expect((await response.json()).leg).toMatchObject({ module: 'dolar', leg: { id: C.buyLeg } })
    expect(db.pesosRows.map((r) => r.id)).toEqual([ID.buy])
    expect(db.dolarRows.find((r) => r.id === C.buyLeg)).toMatchObject({ type: 'SELL', cedearId: C.buy })
    expect(Number(db.cedearRows[0].price)).toBe(16)

    // Y de vuelta, con otra cantidad: la pata se actualiza en Pesos
    await cedearById.PATCH(json({ ...buy, quantity: 5 }), ctx(C.buy))
    expect(db.dolarRows.map((r) => r.id)).toEqual([ID.other])
    expect(Number(db.pesosRows.find((r) => r.id === C.buyLeg)?.amount)).toBe(101_000)
  })

  it('no se borra la compra si sus CEDEARs ya se vendieron; borrar la venta devuelve los pesos', async () => {
    await cedears.POST(json({ ...buy, id: C.buy, legId: C.buyLeg }))
    await cedears.POST(json({ ...buy, type: 'SELL', quantity: 4, fee: 0, date: '2026-03-01T03:00:00.000Z', id: C.sell, legId: C.sellLeg }))

    const blocked = await cedearById.DELETE(json({}), ctx(C.buy))
    expect(blocked.status).toBe(422)
    expect((await blocked.json()).error).toBe(
      'No se puede eliminar: la venta de AAPL del 01/03/2026 quedaría sin CEDEARs.',
    )

    expect((await cedearById.DELETE(json({}), ctx(C.sell))).status).toBe(204)
    expect(db.cedearRows.map((r) => r.id)).toEqual([C.buy])
    expect(db.pesosRows.map((r) => r.id).sort()).toEqual([ID.buy, C.buyLeg].sort())
  })

  it('la pata no se edita ni se borra desde /api/pesos', async () => {
    await cedears.POST(json({ ...buy, id: C.buy, legId: C.buyLeg }))
    expect((await pesosById.DELETE(json({}), ctx(C.buyLeg))).status).toBe(422)
    expect(db.pesosRows).toHaveLength(2)
  })

  it('ownership: otro usuario no la ve, no la edita ni la borra (404)', async () => {
    await cedears.POST(json({ ...buy, id: C.buy, legId: C.buyLeg }))
    session.userId = 'user_b'
    expect((await (await cedears.GET()).json()).transactions).toEqual([])
    expect((await cedearById.PATCH(json(buy), ctx(C.buy))).status).toBe(404)
    expect((await cedearById.DELETE(json({}), ctx(C.buy))).status).toBe(404)
    expect(db.cedearRows).toHaveLength(1)
  })

  it('409 si el id ya existe', async () => {
    await cedears.POST(json({ ...buy, id: C.buy, legId: C.buyLeg }))
    const response = await cedears.POST(json({ ...buy, id: C.buy, legId: C.sellLeg }))
    expect(response.status).toBe(409)
  })
})
