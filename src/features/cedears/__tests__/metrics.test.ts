import { describe, expect, it } from 'vitest'
import {
  cedearAmounts,
  cedearTotal,
  computeCedearPositions,
  summarizeCedears,
} from '@/features/cedears/metrics'
import type { CedearTransaction } from '@/features/cedears/types'
import { TransactionType } from '@/types/transaction.types'

const op = (
  id: string,
  type: TransactionType,
  quantity: number,
  price: number,
  date: string,
  extra: Partial<CedearTransaction> = {},
): CedearTransaction => ({
  id,
  ticker: 'AAPL',
  type,
  quantity,
  price,
  currency: 'ARS',
  fxRate: 1500,
  date: new Date(`${date}T00:00:00`),
  ...extra,
})

const prices = { AAPL: { priceArs: 20_000, change24h: 1.5, updatedAt: null } }

describe('montos de una operación', () => {
  it('la comisión encarece la compra y reduce lo cobrado en la venta', () => {
    expect(cedearTotal(op('a', TransactionType.BUY, 10, 20_000, '2026-01-01', { fee: 1000 }))).toBe(201_000)
    expect(cedearTotal(op('a', TransactionType.SELL, 10, 20_000, '2026-01-01', { fee: 1000 }))).toBe(199_000)
  })

  it('pasa a la otra moneda con el CCL de la operación', () => {
    expect(cedearAmounts(op('a', TransactionType.BUY, 10, 15_000, '2026-01-01'))).toEqual({ ars: 150_000, usd: 100 })
    expect(
      cedearAmounts(op('a', TransactionType.BUY, 10, 10, '2026-01-01', { currency: 'CCL' })),
    ).toEqual({ ars: 150_000, usd: 100 })
  })
})

describe('computeCedearPositions', () => {
  it('comprar y valuar el mismo día con el mismo CCL da PnL 0 en las dos monedas', () => {
    const [position] = computeCedearPositions(
      [op('a', TransactionType.BUY, 10, 20_000, '2026-01-01')],
      prices,
      1500,
    )
    expect(position.unrealizedPnlArs).toBeCloseTo(0, 9)
    expect(position.unrealizedPnlUsd).toBeCloseTo(0, 9)
    expect(position.marketValueUsd).toBeCloseTo(133.333333, 5)
  })

  it('costo promedio y PnL en ARS y USD: ganancia en pesos, pérdida en dólares si sube el CCL', () => {
    const txs = [
      op('a', TransactionType.BUY, 10, 15_000, '2026-01-01'), // 150.000 ARS = 100 USD
      op('b', TransactionType.BUY, 10, 10, '2026-02-01', { currency: 'CCL', fxRate: 1600 }), // 100 USD = 160.000 ARS
      op('c', TransactionType.SELL, 5, 17_000, '2026-03-01', { fxRate: 2000 }), // 85.000 ARS = 42,5 USD
    ]
    const [p] = computeCedearPositions(txs, prices, 2000)
    expect(p.quantity).toBe(15)
    expect(p.averageCostArs).toBe(15_500)
    expect(p.averageCostUsd).toBe(10)
    expect(p.realizedPnlArs).toBe((17_000 - 15_500) * 5)
    expect(p.realizedPnlUsd).toBeCloseTo((8.5 - 10) * 5, 9)
    expect(p.costArs).toBe(15 * 15_500)
    expect(p.marketValueArs).toBe(300_000)
    expect(p.unrealizedPnlArs).toBe(300_000 - 232_500)
    expect(p.unrealizedPnlUsd).toBeCloseTo(150 - 150, 9)
  })

  it('con comisión, el costo la incluye', () => {
    const [p] = computeCedearPositions(
      [op('a', TransactionType.BUY, 10, 20_000, '2026-01-01', { fee: 2000 })],
      prices,
      1500,
    )
    expect(p.costArs).toBe(202_000)
    expect(p.unrealizedPnlArs).toBe(-2000)
  })

  it('sin precio o sin CCL no inventa valores', () => {
    const txs = [op('a', TransactionType.BUY, 10, 20_000, '2026-01-01')]
    const [noPrice] = computeCedearPositions(txs, {}, 1500)
    expect(noPrice.marketValueArs).toBeNull()
    expect(noPrice.unrealizedPnlUsd).toBeNull()
    const [noCcl] = computeCedearPositions(txs, prices, null)
    expect(noCcl.marketValueArs).toBe(200_000)
    expect(noCcl.marketValueUsd).toBeNull()
    expect(summarizeCedears([noCcl]).hasMissingPrices).toBe(true)
  })

  it('una posición cerrada conserva el realizado y no pide precio', () => {
    const txs = [
      op('a', TransactionType.BUY, 10, 15_000, '2026-01-01'),
      op('b', TransactionType.SELL, 10, 18_000, '2026-02-01'),
    ]
    const positions = computeCedearPositions(txs, {}, 1500)
    expect(positions[0].quantity).toBe(0)
    expect(positions[0].realizedPnlArs).toBe(30_000)
    expect(summarizeCedears(positions)).toMatchObject({ realizedPnlArs: 30_000, hasMissingPrices: false })
  })

  it('separa por ticker y resume', () => {
    const txs = [
      op('a', TransactionType.BUY, 10, 20_000, '2026-01-01'),
      op('b', TransactionType.BUY, 2, 30_000, '2026-01-01', { ticker: 'MELI' }),
    ]
    const positions = computeCedearPositions(
      txs,
      { ...prices, MELI: { priceArs: 33_000, change24h: null, updatedAt: null } },
      1500,
    )
    expect(positions.map((p) => p.ticker)).toEqual(['AAPL', 'MELI'])
    const summary = summarizeCedears(positions)
    expect(summary.marketValueArs).toBe(266_000)
    expect(summary.unrealizedPnlArs).toBe(6000)
    expect(summary.unrealizedPnlUsd).toBeCloseTo(4, 9)
  })
})
