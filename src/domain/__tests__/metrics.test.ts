import { describe, expect, it } from 'vitest'
import { computeGroupMetrics, computeTransactionsData } from '@/domain/metrics'
import { DolarOption } from '@/types/dolar.types'
import { TransactionType, type Transaction } from '@/types/transaction.types'

let seq = 0
const tx = (
  type: TransactionType,
  dollarsAmount: number,
  pesosAmount: number,
  date = '2026-01-01',
): Transaction => ({
  id: String(++seq),
  type,
  dollarsAmount,
  pesosAmount,
  date,
  dolarOption: DolarOption.Blue,
})
const buy = (usd: number, ars: number, date?: string) =>
  tx(TransactionType.BUY, usd, ars, date)
const sell = (usd: number, ars: number, date?: string) =>
  tx(TransactionType.SELL, usd, ars, date)

describe('computeGroupMetrics', () => {
  it('una compra: costo promedio = tipo de cambio pagado', () => {
    const m = computeGroupMetrics([buy(100, 100_000)], { buy: 1150, sell: 1200 })
    expect(m).toEqual({
      totalUsd: 100,
      investedPesos: 100_000,
      averageCost: 1000,
      marketValuePesos: 120_000,
      realizedProfit: 0,
      unrealizedProfit: 20_000,
    })
  })

  it('varias compras: costo promedio ponderado', () => {
    const m = computeGroupMetrics([buy(100, 100_000), buy(300, 360_000)])
    expect(m.totalUsd).toBe(400)
    expect(m.investedPesos).toBe(460_000)
    expect(m.averageCost).toBe(1150)
  })

  it('venta parcial: realiza ganancia y mantiene el costo promedio', () => {
    const m = computeGroupMetrics(
      [buy(100, 100_000), sell(40, 52_000)],
      { buy: 1250, sell: 1300 },
    )
    expect(m.totalUsd).toBe(60)
    expect(m.averageCost).toBe(1000)
    expect(m.investedPesos).toBe(60_000)
    expect(m.realizedProfit).toBe(12_000) // (1300 - 1000) * 40
    expect(m.marketValuePesos).toBe(78_000)
    expect(m.unrealizedProfit).toBe(18_000)
  })

  it('venta con pérdida: ganancia realizada negativa', () => {
    const m = computeGroupMetrics([buy(100, 120_000), sell(50, 50_000)])
    expect(m.realizedProfit).toBe(-10_000)
  })

  it('venta total: posición, invertido y valor de mercado en cero', () => {
    const m = computeGroupMetrics(
      [buy(100, 100_000), sell(100, 110_000)],
      { buy: 1250, sell: 1300 },
    )
    expect(m).toEqual({
      totalUsd: 0,
      investedPesos: 0,
      averageCost: 1000,
      marketValuePesos: 0,
      realizedProfit: 10_000,
      unrealizedProfit: 0,
    })
  })

  it('residuo de coma flotante tras vender todo se redondea a 0', () => {
    const m = computeGroupMetrics([
      buy(0.1, 100),
      buy(0.2, 200),
      sell(0.3, 300),
    ])
    expect(m.totalUsd).toBe(0)
    expect(m.marketValuePesos).toBe(0)
  })

  it('venta excesiva (sin validar timeline): la posición no queda negativa', () => {
    const m = computeGroupMetrics([buy(10, 10_000), sell(20, 20_000)])
    expect(m.totalUsd).toBe(0)
    expect(m.investedPesos).toBe(0)
  })

  it('sin cotización: valor de mercado = costo y sin ganancia no realizada', () => {
    const m = computeGroupMetrics([buy(100, 100_000)])
    expect(m.marketValuePesos).toBe(100_000)
    expect(m.unrealizedProfit).toBe(0)
  })

  it('redondea montos a 2 decimales y USD a 4', () => {
    const m = computeGroupMetrics([buy(3, 1000)], { buy: 0, sell: 333.333 })
    expect(m.averageCost).toBe(333.33)
    expect(m.marketValuePesos).toBe(1000)
    expect(m.totalUsd).toBe(3)
  })

  it('ignora montos no numéricos en vez de propagar NaN', () => {
    const bad = { ...buy(100, 100_000), pesosAmount: NaN }
    const m = computeGroupMetrics([bad])
    expect(m.investedPesos).toBe(0)
    expect(Number.isNaN(m.averageCost)).toBe(false)
  })
})

describe('computeTransactionsData', () => {
  it('calcula por grupo con la cotización de su propio tipo de dólar', () => {
    const data = computeTransactionsData(
      {
        [DolarOption.Blue]: [buy(100, 100_000)],
        [DolarOption.Oficial]: [buy(100, 90_000)],
      },
      {
        [DolarOption.Blue]: { buy: 1150, sell: 1200 },
        [DolarOption.Oficial]: { buy: 950, sell: 1000 },
      },
    )
    expect(data[DolarOption.Blue]?.unrealizedProfit).toBe(20_000)
    expect(data[DolarOption.Oficial]?.unrealizedProfit).toBe(10_000)
  })

  it('omite grupos vacíos', () => {
    const data = computeTransactionsData({ [DolarOption.Blue]: [] }, {})
    expect(data).toEqual({})
  })
})
