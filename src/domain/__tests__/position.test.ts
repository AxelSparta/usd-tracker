import { describe, expect, it } from 'vitest'
import { computePosition } from '@/domain/position'
import { TransactionType } from '@/types/transaction.types'

const { BUY, SELL } = TransactionType

describe('computePosition: resultados de trades', () => {
  it('una ganancia entra a valor de mercado y ese valor se realiza', () => {
    const p = computePosition([
      { type: BUY, quantity: 1, quoteAmount: 100 },
      // +1 unidad que vale 120 hoy
      { type: BUY, quantity: 1, quoteAmount: 120, realizedProfit: 120, trade: true },
    ])
    expect(p).toMatchObject({ quantity: 2, invested: 220, averageCost: 110, realizedProfit: 120, tradeProfit: 120 })
  })

  it('una pérdida sale sin cobrar nada: realiza −costo promedio × cantidad', () => {
    const p = computePosition([
      { type: BUY, quantity: 2, quoteAmount: 200 },
      { type: SELL, quantity: 0.5, quoteAmount: 0, trade: true },
    ])
    expect(p).toMatchObject({ quantity: 1.5, invested: 150, realizedProfit: -50, tradeProfit: -50 })
  })

  it('tradeProfit solo cuenta lo que realizan los trades', () => {
    const p = computePosition([
      { type: BUY, quantity: 2, quoteAmount: 200 },
      { type: SELL, quantity: 1, quoteAmount: 150 },
      { type: SELL, quantity: 1, quoteAmount: 0, trade: true },
    ])
    expect(p.realizedProfit).toBe(-50)
    expect(p.tradeProfit).toBe(-100)
  })

  it('sin trades, tradeProfit es 0', () => {
    expect(computePosition([{ type: BUY, quantity: 1, quoteAmount: 1 }]).tradeProfit).toBe(0)
  })
})
