import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET as prices } from '@/app/api/cedears/prices/route'
import { GET as search } from '@/app/api/cedears/search/route'
import { GET as history } from '@/app/api/history/cedears/route'
import panel from '@/features/cedears/__tests__/panel-2026-10.json'

const req = (url: string) => new NextRequest(`http://localhost${url}`)
const PANEL_DATE = 'Tue, 06 Oct 2026 17:10:23 GMT'
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })

const fetchMock = vi.fn(async (url: string) => {
  if (url.endsWith('/live/arg_cedears')) return json(panel, 200, { date: PANEL_DATE })
  // Así responde data912 un ticker sin histórico
  return json({ Error: 'Nahh no tengo ese ticker loko' })
})

beforeEach(() => {
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('GET /api/cedears/prices', () => {
  it('precio en ARS, variación y cuándo se armó el panel; omite desconocidos y variantes', async () => {
    const body = await (await prices(req('/api/cedears/prices?tickers=aapl,BA.C,NOPE,AAPLC'))).json()
    expect(body).toEqual({
      AAPL: { priceArs: 26740, change24h: 0, updatedAt: Date.parse(PANEL_DATE) },
      'BA.C': { priceArs: 21760, change24h: 0.09, updatedAt: Date.parse(PANEL_DATE) },
    })
  })

  it('400 con un ticker inválido o demasiados', async () => {
    expect((await prices(req('/api/cedears/prices?tickers=AAPL,../X'))).status).toBe(400)
    const many = Array.from({ length: 51 }, (_, i) => `T${i}`).join(',')
    expect((await prices(req(`/api/cedears/prices?tickers=${many}`))).status).toBe(400)
  })

  it('502 si data912 falla', async () => {
    fetchMock.mockImplementationOnce(async () => json({}, 500))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await prices(req('/api/cedears/prices?tickers=AAPL'))).status).toBe(502)
  })
})

describe('GET /api/cedears/search', () => {
  it('sin q: los más operados del día en ARS (por monto, no por cantidad)', async () => {
    const body: { ticker: string }[] = await (await search(req('/api/cedears/search'))).json()
    // MU opera 41 k a $342.025 ($14.253 M) y queda antes que GOOGL, que opera 526 k a $9.635
    // ($5.073 M); GOOGL opera más cantidad que MELI pero menos monto
    expect(body.slice(0, 4).map((c) => c.ticker)).toEqual(['NVDA', 'MU', 'MELI', 'GOOGL'])
    expect(body.map((c) => c.ticker)).not.toContain('GOGLD')
  })

  it('por prefijo del ticker (el exacto primero) y por nombre del catálogo', async () => {
    // BBD (Banco Bradesco) y B (Barrick) entran por el nombre; después del exacto, por monto
    const byTicker = await (await search(req('/api/cedears/search?q=ba'))).json()
    expect(byTicker.map((c: { ticker: string }) => c.ticker)).toEqual(['BA', 'BBD', 'BA.C', 'B'])
    expect(await (await search(req('/api/cedears/search?q=bank'))).json()).toEqual([
      { ticker: 'BA.C', name: 'Bank of America' },
    ])
  })
})

describe('GET /api/history/cedears', () => {
  it('último año en orden, sin cierres en 0; omite tickers sin histórico', async () => {
    const today = new Date().toISOString().slice(0, 10)
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('/historical/cedears/BA.C')
        ? json([
            { date: '2012-11-13', o: 1, h: 1, l: 1, c: 6.95, v: 1, dr: 0, sa: 0 },
            { date: today, o: 1, h: 1, l: 1, c: 21740, v: 1, dr: 0, sa: 0 },
            { date: today, o: 1, h: 1, l: 1, c: 0, v: 0, dr: 0, sa: 0 },
          ])
        : json({ Error: 'Nahh no tengo ese ticker loko' }),
    )
    const body = await (await history(req('/api/history/cedears?tickers=BA.C,NU'))).json()
    expect(body).toEqual({ 'BA.C': [{ date: today, ars: 21740 }] })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://data912.com/historical/cedears/BA.C',
      expect.anything(),
    )
  })

  it('400 con un ticker inválido', async () => {
    expect((await history(req('/api/history/cedears?tickers=AAPL%2F..'))).status).toBe(400)
  })
})
