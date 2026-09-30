import { describe, expect, it } from 'vitest'
import { findNegativeBalance, sortTxs, validateTimeline } from '@/domain/timeline'
import { TransactionType } from '@/types/transaction.types'

const { BUY, SELL } = TransactionType

describe('sortTxs', () => {
  it('ordena por fecha ascendente sin mutar el original', () => {
    const txs = [
      { type: BUY, dollarsAmount: 1, date: '2026-03-01' },
      { type: BUY, dollarsAmount: 2, date: '2026-01-01' },
    ]
    const sorted = sortTxs(txs)
    expect(sorted.map((t) => t.dollarsAmount)).toEqual([2, 1])
    expect(txs[0].dollarsAmount).toBe(1)
  })

  it('mismo día: compras antes que ventas', () => {
    const sorted = sortTxs([
      { type: SELL, dollarsAmount: 1, date: '2026-01-01' },
      { type: BUY, dollarsAmount: 1, date: '2026-01-01' },
    ])
    expect(sorted.map((t) => t.type)).toEqual([BUY, SELL])
  })

  it('acepta Date y string ISO mezclados (estado rehidratado)', () => {
    const sorted = sortTxs([
      { type: BUY, dollarsAmount: 1, date: new Date('2026-02-01') },
      { type: BUY, dollarsAmount: 2, date: '2026-01-01T00:00:00.000Z' },
    ])
    expect(sorted.map((t) => t.dollarsAmount)).toEqual([2, 1])
  })
})

describe('validateTimeline', () => {
  it('acepta ventas cubiertas por compras previas', () => {
    expect(() =>
      validateTimeline([
        { type: BUY, dollarsAmount: 100, date: '2026-01-01' },
        { type: SELL, dollarsAmount: 100, date: '2026-01-02' },
      ]),
    ).not.toThrow()
  })

  it('rechaza una venta que deja balance negativo', () => {
    expect(() =>
      validateTimeline([
        { type: BUY, dollarsAmount: 50, date: '2026-01-01' },
        { type: SELL, dollarsAmount: 100, date: '2026-01-02' },
      ]),
    ).toThrow(/saldo de USD quedaría negativo/)
  })

  it('el mensaje muestra la fecha en formato dd/MM/yyyy', () => {
    expect(() =>
      validateTimeline([
        { type: BUY, dollarsAmount: 50, date: new Date(2026, 0, 1) },
        { type: SELL, dollarsAmount: 100, date: new Date(2026, 0, 2, 21, 5) },
      ]),
    ).toThrow('El saldo de USD quedaría negativo el 02/01/2026.')
  })

  it('rechaza una venta anterior a la compra aunque el total cierre', () => {
    expect(() =>
      validateTimeline(
        sortTxs([
          { type: BUY, dollarsAmount: 100, date: '2026-01-02' },
          { type: SELL, dollarsAmount: 100, date: '2026-01-01' },
        ]),
      ),
    ).toThrow()
  })
})

describe('findNegativeBalance', () => {
  const lot = (type: TransactionType, quantity: number, date = '2026-01-01') => ({
    type,
    quantity,
    date,
  })

  it('devuelve la primera operación que deja el saldo negativo', () => {
    const offending = lot(TransactionType.SELL, 2, '2026-01-02')
    const txs = [lot(TransactionType.BUY, 1), offending, lot(TransactionType.BUY, 5, '2026-01-03')]
    expect(findNegativeBalance(txs, (tx) => tx.quantity)).toBe(offending)
  })

  it('tolera el ruido de coma flotante al vender todo', () => {
    const txs = [
      lot(TransactionType.BUY, 0.1),
      lot(TransactionType.BUY, 0.2),
      lot(TransactionType.SELL, 0.3),
    ]
    expect(findNegativeBalance(txs, (tx) => tx.quantity)).toBeNull()
  })
})
