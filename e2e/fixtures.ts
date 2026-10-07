import { test as base, expect, type Page } from '@playwright/test'

/** Cotizaciones fijas de DolarAPI (el navegador la llama directo) */
export const DOLARES = [
  { casa: 'oficial', nombre: 'Oficial', compra: 1490, venta: 1540 },
  { casa: 'blue', nombre: 'Blue', compra: 1540, venta: 1560 },
  { casa: 'bolsa', nombre: 'Bolsa', compra: 1543.6, venta: 1551.9 },
  { casa: 'cripto', nombre: 'Cripto', compra: 1500, venta: 1520 },
].map((d) => ({ ...d, moneda: 'USD', fechaActualizacion: '2026-10-02T12:00:00.000Z' }))

export const BTC = {
  id: 'bitcoin',
  symbol: 'BTC',
  name: 'Bitcoin',
  image: null,
}

export const ETH = { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', image: null }

/** CEDEARs (data912 vía nuestras rutas `/api/cedears/*`) */
export const AAPL = { ticker: 'AAPL', name: 'Apple' }
export const BANK_OF_AMERICA = { ticker: 'BA.C', name: 'Bank of America' }

/** Serie diaria plana del último año (para el gráfico de evolución) */
const dailySeries = <T>(value: (date: string) => T) => {
  const points: T[] = []
  for (let i = 365; i >= 0; i--) {
    points.push(value(new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10)))
  }
  return points
}

/** Simula las APIs externas y nuestras rutas que dependen de ellas */
export const mockApis = async (page: Page) => {
  await page.route('https://dolarapi.com/**', (route) => route.fulfill({ json: DOLARES }))
  await page.route('**/api/crypto/search**', (route) => route.fulfill({ json: [BTC, ETH] }))
  await page.route('**/api/crypto/prices**', (route) =>
    route.fulfill({
      json: { bitcoin: { usd: 60_000, change24h: 1.5, updatedAt: Date.now() } },
    }),
  )
  await page.route('**/api/history/dolar**', (route) =>
    route.fulfill({
      json: Object.fromEntries(
        DOLARES.map((d) => [d.casa, dailySeries((date) => ({ date, buy: d.compra, sell: d.venta }))]),
      ),
    }),
  )
  await page.route('**/api/history/crypto**', (route) =>
    route.fulfill({ json: { bitcoin: dailySeries((date) => ({ date, usd: 60_000 })) } }),
  )
  await page.route('**/api/cedears/search**', (route) =>
    route.fulfill({ json: [AAPL, BANK_OF_AMERICA] }),
  )
  await page.route('**/api/cedears/prices**', (route) =>
    route.fulfill({
      json: {
        AAPL: { priceArs: 26_000, change24h: 0.5, updatedAt: Date.now() },
        'BA.C': { priceArs: 21_000, change24h: -0.2, updatedAt: Date.now() },
      },
    }),
  )
  await page.route('**/api/history/cedears**', (route) =>
    route.fulfill({ json: { AAPL: dailySeries((date) => ({ date, ars: 26_000 })) } }),
  )
}

/** Datos locales cargados antes de que arranque la app (como si ya hubiera operado) */
export const seedLocalData = async (page: Page) => {
  const date = new Date(Date.now() - 10 * 86_400_000).toISOString()
  await page.addInitScript(
    ({ date, btc }) => {
      localStorage.setItem(
        'transactions-storage',
        JSON.stringify({
          state: {
            transactions: {
              blue: [
                {
                  id: '00000000-0000-4000-8000-000000000001',
                  type: 'BUY',
                  pesosAmount: 150_000,
                  dollarsAmount: 100,
                  date,
                  dolarOption: 'blue',
                },
              ],
            },
          },
          version: 1,
        }),
      )
      localStorage.setItem(
        'crypto-storage',
        JSON.stringify({
          state: {
            transactions: [
              {
                id: '00000000-0000-4000-8000-000000000002',
                coinId: 'bitcoin',
                type: 'BUY',
                quantity: 0.5,
                priceUsd: 50_000,
                date,
              },
            ],
            coins: { bitcoin: btc },
          },
          version: 2,
        }),
      )
    },
    { date, btc: BTC },
  )
}

export const test = base.extend<{ page: Page }>({
  // `provide` en vez de `use`: la regla de hooks de React confunde el nombre
  page: async ({ page }, provide) => {
    await mockApis(page)
    await provide(page)
  },
})

export { expect }
