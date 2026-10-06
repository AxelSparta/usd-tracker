import { describe, expect, it } from 'vitest'
import {
  computeValueHistory,
  eachDateKey,
  priceAt,
  trimLeadingGaps,
} from '@/features/portfolio/history'
import type { CryptoTransaction } from '@/features/crypto/types'
import { DolarOption } from '@/types/dolar.types'
import { TransactionType, type Transaction } from '@/types/transaction.types'

// Medianoche local, como las guarda el <Calendar>
const local = (key: string) => new Date(`${key}T00:00:00`)

const dolarTx = (type: TransactionType, dollarsAmount: number, date: string): Transaction => ({
  id: date + type,
  type,
  dollarsAmount,
  pesosAmount: 0,
  date: local(date),
  dolarOption: DolarOption.Blue,
})
const cryptoTx = (
  type: TransactionType,
  quantity: number,
  date: string,
  extra: Partial<CryptoTransaction> = {},
): CryptoTransaction => ({
  id: date + type,
  coinId: 'bitcoin',
  type,
  quantity,
  priceUsd: 0,
  date: local(date),
  ...extra,
})

const blue = [
  { date: '2026-01-01', buy: 1000, sell: 1100 },
  // 02 y 03 sin cotización (fin de semana): se usa la del 01
  { date: '2026-01-04', buy: 1200, sell: 1300 },
]
const cripto = [{ date: '2026-01-01', buy: 1500, sell: 1550 }]

describe('helpers', () => {
  it('eachDateKey incluye ambos extremos', () => {
    expect(eachDateKey('2026-01-30', '2026-02-02')).toEqual([
      '2026-01-30',
      '2026-01-31',
      '2026-02-01',
      '2026-02-02',
    ])
  })

  it('priceAt usa el último precio conocido', () => {
    expect(priceAt(blue, '2025-12-31')).toBeNull()
    expect(priceAt(blue, '2026-01-03')?.sell).toBe(1100)
    expect(priceAt(blue, '2026-01-04')?.sell).toBe(1300)
    expect(priceAt(blue, '2026-02-01')?.sell).toBe(1300)
  })
})

describe('computeValueHistory', () => {
  it('dólar: USD = lo que se tiene; ARS a la venta del día (con relleno)', () => {
    const points = computeValueHistory({
      dolarTxs: [
        dolarTx(TransactionType.BUY, 100, '2026-01-01'),
        dolarTx(TransactionType.SELL, 40, '2026-01-03'),
      ],
      cryptoTxs: [],
      dolarPrices: { blue },
      coinPrices: {},
      from: '2026-01-01',
      to: '2026-01-04',
    })
    expect(points).toEqual([
      { date: '2026-01-01', usd: 100, ars: 110_000 },
      { date: '2026-01-02', usd: 100, ars: 110_000 },
      { date: '2026-01-03', usd: 60, ars: 66_000 },
      { date: '2026-01-04', usd: 60, ars: 78_000 },
    ])
  })

  it('lo operado antes de `from` cuenta desde el primer día', () => {
    const [first] = computeValueHistory({
      dolarTxs: [dolarTx(TransactionType.BUY, 10, '2025-06-01')],
      cryptoTxs: [],
      dolarPrices: { blue },
      coinPrices: {},
      from: '2026-01-01',
      to: '2026-01-01',
    })
    expect(first).toEqual({ date: '2026-01-01', usd: 10, ars: 11_000 })
  })

  it('cripto: USD al precio del día; ARS con el dólar cripto compra; comisión en la moneda', () => {
    const points = computeValueHistory({
      dolarTxs: [],
      cryptoTxs: [
        cryptoTx(TransactionType.BUY, 1, '2026-01-01', { fee: { amount: 0.5, currency: 'COIN' } }),
      ],
      dolarPrices: { cripto },
      coinPrices: {
        bitcoin: [
          { date: '2026-01-01', usd: 100 },
          { date: '2026-01-02', usd: 120 },
        ],
      },
      from: '2026-01-01',
      to: '2026-01-02',
    })
    // Se acreditaron 0,5 BTC (1 − 0,5 de comisión)
    expect(points).toEqual([
      { date: '2026-01-01', usd: 50, ars: 75_000 },
      { date: '2026-01-02', usd: 60, ars: 90_000 },
    ])
  })

  it('sin precio de un activo en cartera → null (no se inventa)', () => {
    const points = computeValueHistory({
      dolarTxs: [dolarTx(TransactionType.BUY, 10, '2026-01-01')],
      cryptoTxs: [cryptoTx(TransactionType.BUY, 1, '2026-01-01')],
      dolarPrices: { blue },
      coinPrices: { bitcoin: [{ date: '2026-01-02', usd: 100 }] },
      from: '2026-01-01',
      to: '2026-01-02',
    })
    expect(points[0]).toEqual({ date: '2026-01-01', usd: null, ars: null })
    // Sin cotización del dólar cripto: USD sí, ARS no
    expect(points[1]).toEqual({ date: '2026-01-02', usd: 110, ars: null })
  })

  it('posiciones cerradas valen 0 (y el polvo de coma flotante también)', () => {
    const points = computeValueHistory({
      dolarTxs: [],
      cryptoTxs: [
        cryptoTx(TransactionType.BUY, 0.1, '2026-01-01'),
        cryptoTx(TransactionType.BUY, 0.2, '2026-01-01', { id: 'b2' }),
        cryptoTx(TransactionType.SELL, 0.3, '2026-01-02'),
      ],
      dolarPrices: { cripto },
      coinPrices: {},
      from: '2026-01-02',
      to: '2026-01-02',
    })
    expect(points).toEqual([{ date: '2026-01-02', usd: 0, ars: 0 }])
  })
})

describe('trimLeadingGaps', () => {
  const points = [
    { date: 'a', usd: null, ars: null },
    { date: 'b', usd: 1, ars: null },
    { date: 'c', usd: 2, ars: 3 },
  ]
  it('recorta hasta el primer día con valor e informa desde cuándo', () => {
    expect(trimLeadingGaps(points, 'usd')).toEqual({ points: points.slice(1), gapUntil: 'b' })
    expect(trimLeadingGaps(points, 'ars').gapUntil).toBe('c')
    expect(trimLeadingGaps(points.slice(2), 'usd')).toEqual({ points: points.slice(2), gapUntil: null })
    expect(trimLeadingGaps([points[0]], 'usd').points).toEqual([])
  })
})

describe('computeValueHistory con Pesos', () => {
  const mep = [
    { date: '2026-01-01', buy: 1450, sell: 1500 },
    { date: '2026-01-03', buy: 1950, sell: 2000 },
  ]
  const pesos = (type: TransactionType, amount: number, date: string) => ({
    id: date + type,
    type,
    amount,
    date: local(date),
  })

  it('ARS = saldo; USD = saldo / MEP venta del día (con relleno)', () => {
    const points = computeValueHistory({
      dolarTxs: [],
      cryptoTxs: [],
      pesosMovements: [
        pesos(TransactionType.BUY, 300_000, '2026-01-01'),
        pesos(TransactionType.SELL, 100_000, '2026-01-02'),
      ],
      dolarPrices: { [DolarOption.Bolsa]: mep },
      coinPrices: {},
      from: '2026-01-01',
      to: '2026-01-03',
    })
    expect(points).toEqual([
      { date: '2026-01-01', ars: 300_000, usd: 200 },
      { date: '2026-01-02', ars: 200_000, usd: 200_000 / 1500 },
      { date: '2026-01-03', ars: 200_000, usd: 100 },
    ])
  })

  it('sin MEP ese día, USD es null pero ARS sigue', () => {
    const [point] = computeValueHistory({
      dolarTxs: [],
      cryptoTxs: [],
      pesosMovements: [pesos(TransactionType.BUY, 1000, '2026-01-01')],
      dolarPrices: {},
      coinPrices: {},
      from: '2026-01-01',
      to: '2026-01-01',
    })
    expect(point).toEqual({ date: '2026-01-01', ars: 1000, usd: null })
  })
})
