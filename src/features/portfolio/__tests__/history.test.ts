import { describe, expect, it } from 'vitest'
import {
  computeValueHistory,
  eachDateKey,
  priceAt,
  trimLeadingGaps,
} from '@/features/portfolio/history'
import { buildFundingLeg } from '@/features/cedears/operations'
import type { CedearTransaction } from '@/features/cedears/types'
import type { CryptoTransaction } from '@/features/crypto/types'
import type { PesosMovement } from '@/features/pesos/types'
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

describe('moneda sin histórico en CoinGecko', () => {
  it('usa el precio de la operación y lo arrastra', () => {
    const points = computeValueHistory({
      dolarTxs: [],
      cryptoTxs: [cryptoTx(TransactionType.BUY, 2, '2026-01-01', { priceUsd: 50 })],
      dolarPrices: {},
      coinPrices: {},
      from: '2026-01-01',
      to: '2026-01-02',
    })
    expect(points.map((p) => p.usd)).toEqual([100, 100])
  })
})

describe('CEDEARs (Fase 10)', () => {
  const ccl = [{ date: '2026-01-01', buy: 1580, sell: 1600 }]
  const aapl = [
    { date: '2026-01-01', ars: 26_000 },
    // 03 sin cierre: se usa el del 02
    { date: '2026-01-02', ars: 32_000 },
  ]
  const cedearTx = (overrides: Partial<CedearTransaction> = {}): CedearTransaction => ({
    id: '00000000-0000-4000-8000-0000000000a1',
    ticker: 'AAPL',
    type: TransactionType.BUY,
    quantity: 10,
    price: 16.25,
    currency: 'CCL',
    fxRate: 1600,
    date: local('2026-01-02'),
    ...overrides,
  })

  it('ARS = cantidad × cierre del día; USD = eso / CCL venta', () => {
    const points = computeValueHistory({
      dolarTxs: [],
      cryptoTxs: [],
      cedearTxs: [cedearTx({ date: local('2026-01-01') })],
      cedearPrices: { AAPL: aapl },
      dolarPrices: { [DolarOption.ContadoConLiqui]: ccl },
      coinPrices: {},
      from: '2026-01-01',
      to: '2026-01-03',
    })
    expect(points).toEqual([
      { date: '2026-01-01', ars: 260_000, usd: 162.5 },
      { date: '2026-01-02', ars: 320_000, usd: 200 },
      { date: '2026-01-03', ars: 320_000, usd: 200 },
    ])
  })

  it('sin histórico del CEDEAR → precio de la operación (sin comisión), arrastrado; hoy en vivo', () => {
    // Pasa con IBIT: data912 no tiene su histórico
    const points = computeValueHistory({
      dolarTxs: [],
      cryptoTxs: [],
      cedearTxs: [cedearTx({ date: local('2026-01-01'), fee: 5 })],
      cedearPrices: { AAPL: [{ date: '2026-01-03', ars: 30_000 }] },
      dolarPrices: { [DolarOption.ContadoConLiqui]: ccl },
      coinPrices: {},
      from: '2026-01-01',
      to: '2026-01-03',
    })
    expect(points).toEqual([
      { date: '2026-01-01', ars: 260_000, usd: 162.5 },
      { date: '2026-01-02', ars: 260_000, usd: 162.5 },
      { date: '2026-01-03', ars: 300_000, usd: 187.5 },
    ])
  })

  it('el cierre de mercado manda sobre el precio de la operación', () => {
    const [point] = computeValueHistory({
      dolarTxs: [],
      cryptoTxs: [],
      // Pagado a 20 × 1600 = 32.000 por CEDEAR; cierre del día 26.000
      cedearTxs: [cedearTx({ date: local('2026-01-01'), price: 20 })],
      cedearPrices: { AAPL: aapl },
      dolarPrices: { [DolarOption.ContadoConLiqui]: ccl },
      coinPrices: {},
      from: '2026-01-01',
      to: '2026-01-01',
    })
    expect(point.ars).toBe(260_000)
  })

  it('sin CCL, USD es null pero ARS sigue', () => {

    const [noCcl] = computeValueHistory({
      dolarTxs: [],
      cryptoTxs: [],
      cedearTxs: [cedearTx({ date: local('2026-01-01') })],
      cedearPrices: { AAPL: aapl },
      dolarPrices: {},
      coinPrices: {},
      from: '2026-01-01',
      to: '2026-01-01',
    })
    expect(noCcl).toEqual({ date: '2026-01-01', ars: 260_000, usd: null })
  })

  // Comprar al precio y al CCL del día pasa valor de un módulo a otro: el total no cambia
  it('una compra con CCL al precio del día no cambia el total (ni en USD ni en ARS)', () => {
    const tx = cedearTx({ price: 26_000 / 1600, date: local('2026-01-01') })
    const { leg } = buildFundingLeg(tx, '00000000-0000-4000-8000-0000000000a2')
    const cclBuy: Transaction = {
      ...dolarTx(TransactionType.BUY, 1000, '2025-12-31'),
      dolarOption: DolarOption.ContadoConLiqui,
    }
    const input = {
      cryptoTxs: [],
      cedearPrices: { AAPL: aapl },
      dolarPrices: { [DolarOption.ContadoConLiqui]: ccl },
      coinPrices: {},
      from: '2026-01-01',
      to: '2026-01-01',
    }
    const [before] = computeValueHistory({ ...input, dolarTxs: [cclBuy] })
    const [after] = computeValueHistory({
      ...input,
      dolarTxs: [cclBuy, leg as Transaction],
      cedearTxs: [tx],
    })
    expect(after.usd).toBeCloseTo(before.usd!, 9)
    expect(after.ars).toBeCloseTo(before.ars!, 6)
  })

  it('una compra con pesos al precio del día no cambia el total en ARS', () => {
    const tx = cedearTx({ currency: 'ARS', price: 26_000, date: local('2026-01-01') })
    const { leg } = buildFundingLeg(tx, '00000000-0000-4000-8000-0000000000a3')
    const income: PesosMovement = {
      id: 'ingreso',
      type: TransactionType.BUY,
      amount: 1_000_000,
      date: local('2025-12-31'),
    }
    const input = {
      dolarTxs: [],
      cryptoTxs: [],
      cedearPrices: { AAPL: aapl },
      dolarPrices: {
        [DolarOption.ContadoConLiqui]: ccl,
        [DolarOption.Bolsa]: [{ date: '2026-01-01', buy: 1540, sell: 1550 }],
      },
      coinPrices: {},
      from: '2026-01-01',
      to: '2026-01-01',
    }
    const [before] = computeValueHistory({ ...input, pesosMovements: [income] })
    const [after] = computeValueHistory({
      ...input,
      pesosMovements: [income, leg as PesosMovement],
      cedearTxs: [tx],
    })
    expect(after.ars).toBeCloseTo(before.ars!, 6)
    // En USD cambia por la diferencia entre el MEP (pesos) y el CCL (CEDEARs)
    expect(after.usd).not.toBeCloseTo(before.usd!, 2)
  })
})
