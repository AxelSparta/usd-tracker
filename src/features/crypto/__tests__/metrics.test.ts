import { describe, expect, it } from 'vitest'
import {
  computeCryptoPositions,
  groupByCoin,
  summarizePortfolio,
  toPositionLot,
} from '@/features/crypto/metrics'
import type { Coin, CryptoTransaction } from '@/features/crypto/types'
import { TransactionType } from '@/types/transaction.types'

const coins: Record<string, Coin> = {
  bitcoin: { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', image: null },
  ethereum: { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', image: null },
}

let seq = 0
const tx = (
  coinId: string,
  type: TransactionType,
  quantity: number,
  priceUsd: number,
  date = '2026-01-01',
): CryptoTransaction => ({ id: String(++seq), coinId, type, quantity, priceUsd, date })
const buy = (coinId: string, qty: number, price: number, date?: string) =>
  tx(coinId, TransactionType.BUY, qty, price, date)
const sell = (coinId: string, qty: number, price: number, date?: string) =>
  tx(coinId, TransactionType.SELL, qty, price, date)

describe('groupByCoin', () => {
  it('agrupa por moneda y ordena cada grupo por fecha (compras antes que ventas)', () => {
    const s = sell('bitcoin', 1, 50_000, '2026-02-01')
    const b1 = buy('bitcoin', 2, 40_000, '2026-02-01')
    const b0 = buy('bitcoin', 1, 30_000, '2026-01-01')
    const e = buy('ethereum', 1, 2_000)
    const groups = groupByCoin([s, e, b1, b0])
    expect(groups.bitcoin).toEqual([b0, b1, s])
    expect(groups.ethereum).toEqual([e])
  })
})

describe('computeCryptoPositions', () => {
  it('costo promedio ponderado en USD y valor de mercado', () => {
    const [btc] = computeCryptoPositions(
      [buy('bitcoin', 0.5, 40_000), buy('bitcoin', 0.5, 60_000)],
      coins,
      { bitcoin: { usd: 70_000, change24h: 2, updatedAt: null } },
    )
    expect(btc.quantity).toBe(1)
    expect(btc.averageCostUsd).toBe(50_000)
    expect(btc.investedUsd).toBe(50_000)
    expect(btc.marketValueUsd).toBe(70_000)
    expect(btc.unrealizedPnlUsd).toBe(20_000)
    expect(btc.unrealizedPnlPct).toBe(40)
    expect(btc.change24h).toBe(2)
  })

  it('venta parcial: realiza PnL y conserva el costo promedio', () => {
    const [btc] = computeCryptoPositions(
      [buy('bitcoin', 2, 30_000), sell('bitcoin', 0.5, 50_000, '2026-02-01')],
      coins,
      {},
    )
    expect(btc.quantity).toBe(1.5)
    expect(btc.averageCostUsd).toBe(30_000)
    expect(btc.realizedPnlUsd).toBe(10_000) // (50k − 30k) × 0,5
  })

  it('cantidades chicas no se descartan como ruido', () => {
    const [btc] = computeCryptoPositions(
      [buy('bitcoin', 0.0005, 60_000), sell('bitcoin', 0.0004, 60_000)],
      coins,
      {},
    )
    expect(btc.quantity).toBeCloseTo(0.0001, 12)
  })

  it('vender todo cierra la posición aunque haya ruido de coma flotante', () => {
    const [btc] = computeCryptoPositions(
      [
        buy('bitcoin', 0.1, 10_000),
        buy('bitcoin', 0.2, 10_000),
        sell('bitcoin', 0.3, 12_000, '2026-02-01'),
      ],
      coins,
      { bitcoin: { usd: 15_000, change24h: null, updatedAt: null } },
    )
    expect(btc.quantity).toBe(0)
    expect(btc.marketValueUsd).toBe(0)
    expect(btc.realizedPnlUsd).toBeCloseTo(600, 6)
  })

  it('sin precio: valor y PnL no realizado quedan en null', () => {
    const [btc] = computeCryptoPositions([buy('bitcoin', 1, 50_000)], coins, {})
    expect(btc.priceUsd).toBeNull()
    expect(btc.marketValueUsd).toBeNull()
    expect(btc.unrealizedPnlUsd).toBeNull()
    expect(btc.unrealizedPnlPct).toBeNull()
  })

  it('omite monedas sin metadatos y ordena por valor de mercado', () => {
    const positions = computeCryptoPositions(
      [buy('ethereum', 10, 2_000), buy('bitcoin', 0.1, 50_000), buy('dogecoin', 100, 0.1)],
      coins,
      {
        bitcoin: { usd: 60_000, change24h: null, updatedAt: null },
        ethereum: { usd: 3_000, change24h: null, updatedAt: null },
      },
    )
    expect(positions.map((p) => p.coin.id)).toEqual(['ethereum', 'bitcoin'])
  })
})

describe('summarizePortfolio', () => {
  it('suma posiciones y marca precios faltantes solo en posiciones abiertas', () => {
    const positions = computeCryptoPositions(
      [
        buy('bitcoin', 1, 50_000),
        buy('ethereum', 1, 2_000),
        sell('ethereum', 1, 3_000, '2026-02-01'),
      ],
      coins,
      { bitcoin: { usd: 60_000, change24h: null, updatedAt: null } },
    )
    expect(summarizePortfolio(positions)).toEqual({
      investedUsd: 50_000,
      marketValueUsd: 60_000,
      unrealizedPnlUsd: 10_000,
      realizedPnlUsd: 1_000,
      hasMissingPrices: false,
    })
  })

  it('hasMissingPrices si una posición abierta no tiene precio', () => {
    const positions = computeCryptoPositions([buy('bitcoin', 1, 50_000)], coins, {})
    expect(summarizePortfolio(positions).hasMissingPrices).toBe(true)
  })
})

describe('comisiones', () => {
  const withFee = (t: CryptoTransaction, amount: number, currency: 'USD' | 'COIN') => ({
    ...t,
    fee: { amount, currency },
  })

  it('compra con comisión en USD: suma al costo', () => {
    const [btc] = computeCryptoPositions(
      [withFee(buy('bitcoin', 1, 50_000), 100, 'USD')],
      coins,
      {},
    )
    expect(btc.quantity).toBe(1)
    expect(btc.investedUsd).toBe(50_100)
    expect(btc.averageCostUsd).toBe(50_100)
  })

  it('compra con comisión en la moneda: acredita menos unidades al mismo costo', () => {
    const [btc] = computeCryptoPositions(
      [withFee(buy('bitcoin', 1, 50_000), 0.01, 'COIN')],
      coins,
      {},
    )
    expect(btc.quantity).toBeCloseTo(0.99, 12)
    expect(btc.investedUsd).toBe(50_000)
    expect(btc.averageCostUsd).toBeCloseTo(50_000 / 0.99, 6)
  })

  it('venta con comisión en USD: reduce el PnL realizado', () => {
    const [btc] = computeCryptoPositions(
      [buy('bitcoin', 1, 50_000), withFee(sell('bitcoin', 1, 60_000, '2026-02-01'), 50, 'USD')],
      coins,
      {},
    )
    expect(btc.quantity).toBe(0)
    expect(btc.realizedPnlUsd).toBe(9_950)
  })

  it('venta con comisión en la moneda: debita la cantidad más la comisión', () => {
    const [btc] = computeCryptoPositions(
      [buy('bitcoin', 1, 50_000), withFee(sell('bitcoin', 0.5, 60_000, '2026-02-01'), 0.01, 'COIN')],
      coins,
      {},
    )
    expect(btc.quantity).toBeCloseTo(0.49, 12)
    // cobra 30.000 por 0,51 BTC con costo 50.000 c/u
    expect(btc.realizedPnlUsd).toBeCloseTo(30_000 - 0.51 * 50_000, 6)
  })
})

describe('toPositionLot', () => {
  it('sin comisión: cantidad y total bruto', () => {
    expect(toPositionLot(buy('bitcoin', 2, 10))).toEqual({
      type: TransactionType.BUY,
      quantity: 2,
      quoteAmount: 20,
    })
  })
})
