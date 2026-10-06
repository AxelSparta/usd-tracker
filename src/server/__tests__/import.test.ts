import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeDb, type FakeDb } from './fake-db'

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

const { POST } = await import('@/app/api/sync/import/route')
const dolarRoute = await import('@/app/api/dolar/transactions/route')
const cryptoRoute = await import('@/app/api/crypto/transactions/route')

const json = (body: unknown) => new Request('http://x', { method: 'POST', body: JSON.stringify(body) })
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

const btc = { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', image: null }
const dolarTx = (n: number, type: 'BUY' | 'SELL', dollarsAmount: number, date: string) => ({
  id: uuid(n),
  type,
  dollarsAmount,
  pesosAmount: dollarsAmount * 1000,
  date,
  dolarOption: 'blue',
})
const cryptoTx = (n: number, type: 'BUY' | 'SELL', quantity: number, date: string, extra = {}) => ({
  id: uuid(n),
  coinId: 'bitcoin',
  type,
  quantity,
  priceUsd: 50_000,
  date,
  ...extra,
})
const payload = {
  dolar: [
    dolarTx(1, 'BUY', 100, '2026-01-01T03:00:00.000Z'),
    dolarTx(2, 'SELL', 40, '2026-02-01T03:00:00.000Z'),
  ],
  crypto: {
    transactions: [cryptoTx(3, 'BUY', 1, '2026-01-01T03:00:00.000Z', { fee: { amount: 5, currency: 'USD' } })],
    coins: { bitcoin: btc },
  },
}

let db: FakeDb
beforeEach(() => {
  db = createFakeDb()
  fake.db = db
  session.userId = 'user_a'
})

describe('POST /api/sync/import', () => {
  it('401 sin sesión', async () => {
    session.userId = null
    expect((await POST(json(payload))).status).toBe(401)
  })

  it('sube todo y es idempotente', async () => {
    const first = await POST(json(payload))
    expect(first.status).toBe(200)
    expect(await first.json()).toEqual({
      dolar: { created: 2, skipped: 0 },
      crypto: { created: 1, skipped: 0 },
      pesos: { created: 0, skipped: 0 },
    })
    const second = await (await POST(json(payload))).json()
    expect(second).toEqual({
      dolar: { created: 0, skipped: 2 },
      crypto: { created: 0, skipped: 1 },
      pesos: { created: 0, skipped: 0 },
    })
    expect(db.dolarRows).toHaveLength(2)

    const { transactions } = await (await cryptoRoute.GET()).json()
    expect(transactions[0].fee).toEqual({ amount: 5, currency: 'USD' })
  })

  it('la nube manda: un id existente conserva la versión de la nube', async () => {
    await dolarRoute.POST(json(dolarTx(1, 'BUY', 500, '2026-01-01T03:00:00.000Z')))
    const result = await (await POST(json(payload))).json()
    expect(result.dolar).toEqual({ created: 1, skipped: 1 })
    const list = await (await dolarRoute.GET()).json()
    expect(list.find((t: { id: string }) => t.id === uuid(1)).dollarsAmount).toBe(500)
  })

  it('un id de otro usuario se saltea sin tocar su operación', async () => {
    session.userId = 'user_b'
    await POST(json({ dolar: [payload.dolar[0]], crypto: { transactions: [], coins: {} } }))
    session.userId = 'user_a'
    const result = await (await POST(json(payload))).json()
    expect(result.dolar).toEqual({ created: 1, skipped: 1 })
    expect(db.dolarRows.find((r) => r.id === uuid(1))?.userId).toBe('user_b')
  })

  it('422 si lo local deja una venta sin saldo', async () => {
    const response = await POST(
      json({ ...payload, dolar: [dolarTx(9, 'SELL', 1, '2026-01-01T03:00:00.000Z')] }),
    )
    expect(response.status).toBe(422)
    expect(db.dolarRows).toHaveLength(0)
    expect(db.cryptoRows).toHaveLength(0)
  })

  it('400 si falta la moneda de una operación cripto', async () => {
    const response = await POST(json({ ...payload, crypto: { ...payload.crypto, coins: {} } }))
    expect(response.status).toBe(400)
  })

  it('conserva el enlace de los intercambios', async () => {
    const eth = { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', image: null }
    const swapId = uuid(99)
    await POST(
      json({
        dolar: [],
        crypto: {
          transactions: [
            cryptoTx(3, 'BUY', 1, '2026-01-01T03:00:00.000Z'),
            cryptoTx(4, 'SELL', 0.5, '2026-02-01T03:00:00.000Z', { swapId }),
            { ...cryptoTx(5, 'BUY', 10, '2026-02-01T03:00:00.000Z', { swapId }), coinId: 'ethereum' },
          ],
          coins: { bitcoin: btc, ethereum: eth },
        },
      }),
    )
    const { transactions } = await (await cryptoRoute.GET()).json()
    expect(transactions.filter((t: { swapId?: string }) => t.swapId === swapId)).toHaveLength(2)
  })
})

describe('importación con intercambios USDT', () => {
  const usdtBuy = { ...dolarTx(10, 'BUY', 1000, '2026-01-01T03:00:00.000Z'), dolarOption: 'cripto' }
  const usdtLeg = {
    ...dolarTx(11, 'SELL', 500, '2026-02-01T03:00:00.000Z'),
    dolarOption: 'cripto',
    usdtSwapId: uuid(13),
  }
  const coinLeg = cryptoTx(12, 'BUY', 0.01, '2026-02-01T03:00:00.000Z', { usdtSwapId: uuid(13) })

  it('sube las dos patas enlazadas', async () => {
    const response = await POST(
      json({ dolar: [usdtBuy, usdtLeg], crypto: { transactions: [coinLeg], coins: { bitcoin: btc } } }),
    )
    expect(response.status).toBe(200)
    expect(db.dolarRows.find((r) => r.id === uuid(11))?.usdtSwapId).toBe(uuid(13))
    expect(db.cryptoRows[0].usdtSwapId).toBe(uuid(13))
  })

  it('422 si llega una pata sin la otra', async () => {
    const response = await POST(
      json({ dolar: [usdtBuy, usdtLeg], crypto: { transactions: [], coins: {} } }),
    )
    expect(response.status).toBe(422)
    expect((await response.json()).error).toBe('Hay un intercambio con USDT incompleto.')
    expect(db.dolarRows).toHaveLength(0)
  })
})

describe('importación con resultados de trades', () => {
  const gain = { ...dolarTx(20, 'BUY', 50, '2026-02-01T03:00:00.000Z'), dolarOption: 'cripto', kind: 'TRADE_RESULT', note: 'futuros' }

  it('sube kind y note', async () => {
    const response = await POST(json({ dolar: [gain], crypto: { transactions: [], coins: {} } }))
    expect(response.status).toBe(200)
    expect(db.dolarRows[0]).toMatchObject({ kind: 'TRADE_RESULT', note: 'futuros' })
  })

  it('422 si un resultado de trade no está en el dólar cripto', async () => {
    const response = await POST(
      json({ dolar: [{ ...gain, dolarOption: 'blue' }], crypto: { transactions: [], coins: {} } }),
    )
    expect(response.status).toBe(422)
  })
})

describe('importación de pesos', () => {
  const pesosMovement = (n: number, type: 'BUY' | 'SELL', amount: number, date: string) => ({
    id: uuid(n),
    type,
    amount,
    date,
  })
  const empty = { dolar: [], crypto: { transactions: [], coins: {} } }

  it('sube los movimientos y es idempotente', async () => {
    const body = {
      ...empty,
      pesos: [
        { ...pesosMovement(30, 'BUY', 1000, '2026-01-01T03:00:00.000Z'), note: 'Sueldo' },
        pesosMovement(31, 'SELL', 400, '2026-02-01T03:00:00.000Z'),
      ],
    }
    expect((await (await POST(json(body))).json()).pesos).toEqual({ created: 2, skipped: 0 })
    expect((await (await POST(json(body))).json()).pesos).toEqual({ created: 0, skipped: 2 })
    expect(db.pesosRows.find((r) => r.id === uuid(30))?.note).toBe('Sueldo')
  })

  it('valida el saldo con lo que ya está en la nube', async () => {
    await POST(json({ ...empty, pesos: [pesosMovement(30, 'BUY', 1000, '2026-01-01T03:00:00.000Z')] }))
    const response = await POST(
      json({ ...empty, pesos: [pesosMovement(31, 'SELL', 1500, '2026-02-01T03:00:00.000Z')] }),
    )
    expect(response.status).toBe(422)
    expect((await response.json()).error).toBe('No tenés pesos suficientes el 01/02/2026.')
    expect(db.pesosRows).toHaveLength(1)
  })

  it('un cliente sin pesos (anterior a la Fase 8) sigue funcionando', async () => {
    expect((await POST(json(empty))).status).toBe(200)
  })
})

describe('importación con conversiones de pesos', () => {
  const conversionId = uuid(42)
  const income = { id: uuid(40), type: 'BUY', amount: 3_000_000, date: '2026-01-01T03:00:00.000Z' }
  const pesosLeg = { id: uuid(41), type: 'SELL', amount: 1_560_000, date: '2026-02-01T03:00:00.000Z', conversionId }
  const dolarLeg = { ...dolarTx(43, 'BUY', 1000, '2026-02-01T03:00:00.000Z'), pesosAmount: 1_560_000, conversionId }
  const crypto = { transactions: [], coins: {} }

  it('sube las dos patas enlazadas', async () => {
    const response = await POST(json({ dolar: [dolarLeg], crypto, pesos: [income, pesosLeg] }))
    expect(response.status).toBe(200)
    expect(db.dolarRows[0].conversionId).toBe(conversionId)
    expect(db.pesosRows.find((r) => r.id === uuid(41))?.conversionId).toBe(conversionId)
  })

  it('422 si llega una pata sin la otra', async () => {
    const response = await POST(json({ dolar: [], crypto, pesos: [income, pesosLeg] }))
    expect(response.status).toBe(422)
    expect((await response.json()).error).toBe('Hay una conversión de pesos incompleta.')
    expect(db.pesosRows).toHaveLength(0)
  })

  it('422 si las patas no tienen el mismo monto en ARS', async () => {
    const response = await POST(
      json({ dolar: [{ ...dolarLeg, pesosAmount: 1 }], crypto, pesos: [income, pesosLeg] }),
    )
    expect(response.status).toBe(422)
  })
})
