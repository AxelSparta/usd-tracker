import { describe, expect, it } from 'vitest'
import type { CryptoPosition } from '@/features/crypto/types'
import {
  computePortfolioOverview,
  toAllocationSegments,
  type AssetAllocation,
} from '@/features/portfolio/overview'
import type { TransactionsData } from '@/types/transaction.types'

const dolarGroup = (overrides: Partial<TransactionsData>): TransactionsData => ({
  totalUsd: 0,
  investedPesos: 0,
  marketValuePesos: 0,
  averageCost: 0,
  realizedProfit: 0,
  tradeProfit: 0,
  unrealizedProfit: 0,
  ...overrides,
})

const position = (
  id: string,
  quantity: number,
  marketValueUsd: number | null,
  extra: Partial<CryptoPosition> = {},
): CryptoPosition => ({
  coin: { id, symbol: id.toUpperCase().slice(0, 3), name: id, image: null },
  quantity,
  investedUsd: 0,
  averageCostUsd: 0,
  realizedPnlUsd: 0,
  tradePnlUsd: 0,
  priceUsd: marketValueUsd === null ? null : 1,
  change24h: null,
  marketValueUsd,
  unrealizedPnlUsd: marketValueUsd === null ? null : 0,
  unrealizedPnlPct: null,
  ...extra,
})

const base = {
  dolarLabel: (o: string) => `Dólar ${o}`,
  cryptoArsRate: 1500,
}

describe('computePortfolioOverview', () => {
  it('suma los dos módulos: composición en USD, valores en ARS por cotización', () => {
    const overview = computePortfolioOverview({
      ...base,
      dolarData: {
        blue: dolarGroup({ totalUsd: 100, marketValuePesos: 156_000, realizedProfit: 1000, unrealizedProfit: 6000 }),
      },
      cryptoPositions: [
        position('bitcoin', 0.01, 300, { realizedPnlUsd: 20, unrealizedPnlUsd: 50, change24h: -2.5 }),
      ],
    })

    expect(overview.totalUsd).toBe(400)
    expect(overview.totalArs).toBe(156_000 + 300 * 1500)
    expect(overview.dolar).toMatchObject({ valueUsd: 100, valueArs: 156_000, pnl: 7000, share: 0.25, assets: 1 })
    expect(overview.crypto).toMatchObject({ valueUsd: 300, valueArs: 450_000, pnl: 70, share: 0.75 })
    expect(overview.assets.map((a) => [a.key, a.share, a.href])).toEqual([
      ['crypto:bitcoin', 0.75, '/cripto/bitcoin'],
      ['dolar:blue', 0.25, '/dolar'],
    ])
    expect(overview.assets[0].change24h).toBe(-2.5)
  })

  it('posiciones cerradas: no suman valor pero sí su ganancia realizada', () => {
    const overview = computePortfolioOverview({
      ...base,
      dolarData: { blue: dolarGroup({ totalUsd: 0, realizedProfit: 500 }) },
      cryptoPositions: [position('eth', 0, 0, { realizedPnlUsd: 10 })],
    })
    expect(overview.assets).toEqual([])
    expect(overview.totalUsd).toBe(0)
    expect(overview.dolar.pnl).toBe(500)
    expect(overview.crypto.pnl).toBe(10)
  })

  it('sin precio: la moneda se informa y no suma; sin dólar cripto, ARS de cripto es null', () => {
    const overview = computePortfolioOverview({
      ...base,
      cryptoArsRate: null,
      dolarData: { oficial: dolarGroup({ totalUsd: 10, marketValuePesos: 15_000 }) },
      cryptoPositions: [position('bitcoin', 1, 100), position('raro', 5, null)],
    })
    expect(overview.missingPrices).toEqual(['RAR'])
    expect(overview.totalUsd).toBe(110)
    expect(overview.crypto.valueArs).toBeNull()
    expect(overview.totalArs).toBeNull()
    expect(overview.dolar.valueArs).toBe(15_000)
  })
})

describe('toAllocationSegments', () => {
  const asset = (key: string, valueUsd: number): AssetAllocation => ({
    key,
    module: 'crypto',
    label: key,
    symbol: null,
    image: null,
    href: '/',
    valueUsd,
    valueArs: null,
    change24h: null,
    share: valueUsd / 100,
  })

  it('pliega la cola en "Otros" (gris) y respeta el orden por valor', () => {
    const assets = [50, 20, 10, 8, 5, 4, 3].map((v, i) => asset(`k${i}`, v))
    const segments = toAllocationSegments(assets, 6)
    expect(segments.map((s) => s.key)).toEqual(['k0', 'k1', 'k2', 'k3', 'k4', 'others'])
    expect(segments[5]).toMatchObject({ label: 'Otros (2)', valueUsd: 7, colorIndex: null })
    expect(segments[5].share).toBeCloseTo(0.07)
  })

  it('el color sigue al activo aunque cambie el orden', () => {
    const before = toAllocationSegments([asset('crypto:btc', 60), asset('crypto:eth', 40)])
    const after = toAllocationSegments([asset('crypto:eth', 70), asset('crypto:btc', 30)])
    const colorOf = (list: typeof before, key: string) => list.find((s) => s.key === key)?.colorIndex
    expect(colorOf(after, 'crypto:btc')).toBe(colorOf(before, 'crypto:btc'))
    expect(colorOf(after, 'crypto:eth')).toBe(colorOf(before, 'crypto:eth'))
  })
})

describe('computePortfolioOverview con Pesos', () => {
  it('el saldo entra en ARS tal cual y en USD al MEP venta, sin ganancia', () => {
    const overview = computePortfolioOverview({
      ...base,
      dolarData: { blue: dolarGroup({ totalUsd: 100, marketValuePesos: 156_000 }) },
      cryptoPositions: [],
      pesosBalance: 155_000,
      mepRate: 1550,
    })
    expect(overview.pesos).toMatchObject({ valueUsd: 100, valueArs: 155_000, pnl: null, share: 0.5, assets: 1 })
    expect(overview.totalArs).toBe(311_000)
    expect(overview.assets.find((a) => a.key === 'pesos:ars')).toMatchObject({ href: '/pesos', label: 'Pesos' })
  })

  it('sin MEP no entra a la composición y se avisa', () => {
    const overview = computePortfolioOverview({
      ...base,
      dolarData: {},
      cryptoPositions: [],
      pesosBalance: 1000,
      mepRate: null,
    })
    expect(overview.assets).toEqual([])
    expect(overview.missingPrices).toEqual(['Pesos (sin dólar MEP)'])
  })

  it('una conversión a la cotización de valuación no cambia el total en ARS', () => {
    const before = computePortfolioOverview({
      ...base,
      dolarData: {},
      cryptoPositions: [],
      pesosBalance: 3_120_000,
      mepRate: 1550,
    })
    // Pesos → blue a $1.560 (blue venta): salen 1.560.000 y entran 1.000 USD valuados a venta
    const after = computePortfolioOverview({
      ...base,
      dolarData: { blue: dolarGroup({ totalUsd: 1000, marketValuePesos: 1_560_000 }) },
      cryptoPositions: [],
      pesosBalance: 1_560_000,
      mepRate: 1550,
    })
    expect(after.totalArs).toBe(before.totalArs)
    // En USD solo cambia por la diferencia entre el blue y el MEP
    expect(after.totalUsd - before.totalUsd).toBeCloseTo(1000 - 1_560_000 / 1550)
  })
})
