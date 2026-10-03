import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET as dolarHistory } from '@/app/api/history/dolar/route'
import { GET as cryptoHistory } from '@/app/api/history/crypto/route'

const req = (url: string) => new NextRequest(`http://localhost${url}`)
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

afterEach(() => vi.unstubAllGlobals())

describe('GET /api/history/dolar', () => {
  it('400 con un tipo de dólar inválido', async () => {
    expect((await dolarHistory(req('/api/history/dolar?casas=blue,euro'))).status).toBe(400)
  })

  it('devuelve el último año, ordenado y sin días incompletos', async () => {
    const today = new Date().toISOString().slice(0, 10)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json([
          { casa: 'blue', compra: 4, venta: 4, fecha: '2011-01-03' },
          { casa: 'blue', compra: 1500, venta: 1520, fecha: today },
          { casa: 'blue', compra: null, venta: 1510, fecha: today },
        ]),
      ),
    )
    const body = await (await dolarHistory(req('/api/history/dolar?casas=blue'))).json()
    expect(body).toEqual({ blue: [{ date: today, buy: 1500, sell: 1520 }] })
  })

  it('502 si ArgentinaDatos falla', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({}, 500)))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await dolarHistory(req('/api/history/dolar?casas=blue'))).status).toBe(502)
  })
})

describe('GET /api/history/crypto', () => {
  it('un punto por día (gana el último) y omite monedas desconocidas', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('/coins/nope/')
          ? json({ error: 'coin not found' }, 404)
          : json({
              prices: [
                [Date.UTC(2026, 9, 1), 100],
                [Date.UTC(2026, 9, 2), 110],
                [Date.UTC(2026, 9, 2, 15), 115],
              ],
            }),
      ),
    )
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const body = await (await cryptoHistory(req('/api/history/crypto?ids=bitcoin,nope'))).json()
    expect(body).toEqual({
      bitcoin: [
        { date: '2026-10-01', usd: 100 },
        { date: '2026-10-02', usd: 115 },
      ],
    })
  })

  it('429 de CoinGecko se informa como tal', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({}, 429)))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await cryptoHistory(req('/api/history/crypto?ids=bitcoin'))).status).toBe(429)
  })
})
