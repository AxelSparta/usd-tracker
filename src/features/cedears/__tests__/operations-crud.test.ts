import { describe, expect, it } from 'vitest'
import {
  applyAddCedearTransaction,
  applyRemoveCedearTransaction,
  applyUpdateCedearTransaction,
  assertCedearShape,
  buildFundingLeg,
  type CedearLinkedState,
} from '@/features/cedears/operations'
import type { CedearTransaction } from '@/features/cedears/types'
import { applyRemovePesosMovement } from '@/features/pesos/operations'
import { applyRemoveTransaction } from '@/domain/transactions'
import { DolarOption } from '@/types/dolar.types'
import { TransactionType } from '@/types/transaction.types'

const CCL = DolarOption.ContadoConLiqui
const day = (iso: string) => new Date(`${iso}T00:00:00`)

const input = (
  type: TransactionType,
  quantity: number,
  date: string,
  extra: Partial<CedearTransaction> = {},
): Omit<CedearTransaction, 'id'> => ({
  ticker: 'AAPL',
  type,
  quantity,
  price: 20_000,
  currency: 'ARS',
  fxRate: 1500,
  date: day(date),
  ...extra,
})

/** 1.000.000 ARS en Pesos y 1.000 USD CCL el 1/1 */
const funded: CedearLinkedState = {
  cedears: { transactions: [] },
  pesos: { movements: [{ id: 'income', type: TransactionType.BUY, amount: 1_000_000, date: day('2026-01-01') }] },
  dolar: {
    [CCL]: [{ id: 'ccl', type: TransactionType.BUY, pesosAmount: 1_500_000, dollarsAmount: 1000, date: day('2026-01-01'), dolarOption: CCL }],
  },
}

const buy = (state = funded, extra: Partial<CedearTransaction> = {}) =>
  applyAddCedearTransaction(state, input(TransactionType.BUY, 10, '2026-01-02', extra), { id: 'op', legId: 'leg' })

describe('buildFundingLeg', () => {
  it('con pesos: egreso por el total (comisión incluida)', () => {
    const { leg, module } = buildFundingLeg({ id: 'op', ...input(TransactionType.BUY, 10, '2026-01-02', { fee: 500 }) }, 'leg')
    expect(module).toBe('pesos')
    expect(leg).toMatchObject({ id: 'leg', type: TransactionType.SELL, amount: 200_500, cedearId: 'op' })
  })

  it('con CCL: venta de USD CCL, con los pesos al CCL de la operación', () => {
    const funding = buildFundingLeg(
      { id: 'op', ...input(TransactionType.SELL, 10, '2026-01-02', { currency: 'CCL', price: 13, fee: 1 }) },
      'leg',
    )
    expect(funding).toMatchObject({
      module: 'dolar',
      leg: { type: TransactionType.BUY, dollarsAmount: 129, pesosAmount: 129 * 1500, dolarOption: CCL, cedearId: 'op' },
    })
  })
})

describe('applyAddCedearTransaction', () => {
  it('compra con pesos: la operación y el egreso de pesos', () => {
    const { state } = buy()
    expect(state.cedears.transactions).toHaveLength(1)
    expect(state.pesos.movements.map((m) => m.amount)).toEqual([1_000_000, 200_000])
    expect(state.dolar).toBe(funded.dolar)
  })

  it('compra con CCL: la venta de USD CCL', () => {
    const { state } = buy(funded, { currency: 'CCL', price: 13 })
    expect(state.dolar[CCL]!.map((t) => t.dollarsAmount)).toEqual([1000, 130])
    expect(state.pesos).toBe(funded.pesos)
  })

  it('rechaza sin pesos o sin USD CCL', () => {
    expect(() => buy(funded, { price: 200_000 })).toThrow('No tenés pesos suficientes el 02/01/2026.')
    expect(() => buy(funded, { currency: 'CCL', price: 200 })).toThrow('No tenés suficientes USD CCL el 02/01/2026.')
  })

  it('rechaza vender más CEDEARs de los que hay', () => {
    const { state } = buy()
    expect(() =>
      applyAddCedearTransaction(state, input(TransactionType.SELL, 11, '2026-01-03'), { id: 'op2', legId: 'leg2' }),
    ).toThrow('No tenés suficientes AAPL el 03/01/2026.')
  })

  it('vender acredita los pesos', () => {
    const { state } = buy()
    const sold = applyAddCedearTransaction(state, input(TransactionType.SELL, 10, '2026-01-03', { price: 25_000 }), {
      id: 'op2',
      legId: 'leg2',
    })
    expect(sold.state.pesos.movements.at(-1)).toMatchObject({ type: TransactionType.BUY, amount: 250_000, cedearId: 'op2' })
  })
})

describe('assertCedearShape', () => {
  it('cantidad entera, montos positivos y comisión menor al total', () => {
    expect(() => assertCedearShape(input(TransactionType.BUY, 1.5, '2026-01-02'))).toThrow('número entero')
    expect(() => assertCedearShape(input(TransactionType.BUY, 0, '2026-01-02'))).toThrow('número entero')
    expect(() => assertCedearShape(input(TransactionType.BUY, 1, '2026-01-02', { price: 0 }))).toThrow('precio')
    expect(() => assertCedearShape(input(TransactionType.BUY, 1, '2026-01-02', { fxRate: 0 }))).toThrow('CCL')
    expect(() => assertCedearShape(input(TransactionType.SELL, 1, '2026-01-02', { fee: 20_000 }))).toThrow('comisión')
    expect(() => assertCedearShape(input(TransactionType.BUY, 1, '2026-01-02', { ticker: ' ' }))).toThrow('Elegí')
  })
})

describe('applyUpdateCedearTransaction', () => {
  it('reconstruye la pata con el mismo id', () => {
    const { state } = buy()
    const result = applyUpdateCedearTransaction(state, 'op', input(TransactionType.BUY, 20, '2026-01-02'))!
    expect(result.leg.leg).toMatchObject({ id: 'leg', amount: 400_000 })
    expect(result.state.pesos.movements).toHaveLength(2)
  })

  it('al pasar de pesos a CCL, la pata se mueve de módulo', () => {
    const { state } = buy()
    const result = applyUpdateCedearTransaction(state, 'op', input(TransactionType.BUY, 10, '2026-01-02', { currency: 'CCL', price: 13 }))!
    expect(result.previous.module).toBe('pesos')
    expect(result.leg).toMatchObject({ module: 'dolar', leg: { id: 'leg', dollarsAmount: 130 } })
    expect(result.state.pesos.movements).toHaveLength(1)
    expect(result.state.dolar[CCL]).toHaveLength(2)
  })

  it('revalida el saldo de pesos con el monto nuevo', () => {
    const { state } = buy()
    expect(() => applyUpdateCedearTransaction(state, 'op', input(TransactionType.BUY, 60, '2026-01-02'))).toThrow(
      'No tenés pesos suficientes',
    )
  })

  it('revalida el ticker anterior si se cambió', () => {
    const { state } = buy()
    const sold = applyAddCedearTransaction(state, input(TransactionType.SELL, 5, '2026-01-03'), { id: 'op2', legId: 'leg2' })
    expect(() =>
      applyUpdateCedearTransaction(sold.state, 'op', input(TransactionType.BUY, 10, '2026-01-02', { ticker: 'MELI' })),
    ).toThrow('No tenés suficientes AAPL el 03/01/2026.')
  })

  it('null si no existe', () => {
    expect(applyUpdateCedearTransaction(funded, 'x', input(TransactionType.BUY, 1, '2026-01-02'))).toBeNull()
  })
})

describe('applyRemoveCedearTransaction', () => {
  it('borra la operación y su pata, y devuelve el saldo', () => {
    const { state } = buy()
    const result = applyRemoveCedearTransaction(state, 'op')!
    expect(result.previous?.leg.id).toBe('leg')
    expect(result.state.cedears.transactions).toHaveLength(0)
    expect(result.state.pesos.movements).toHaveLength(1)
  })

  it('rechaza borrar una compra si después se vendió', () => {
    const { state } = buy()
    const sold = applyAddCedearTransaction(state, input(TransactionType.SELL, 10, '2026-01-03'), { id: 'op2', legId: 'leg2' })
    expect(() => applyRemoveCedearTransaction(sold.state, 'op')).toThrow(
      'No se puede eliminar: la venta de AAPL del 03/01/2026 quedaría sin CEDEARs.',
    )
  })

  it('rechaza borrar una venta si los pesos cobrados ya se gastaron', () => {
    const { state } = buy()
    const sold = applyAddCedearTransaction(state, input(TransactionType.SELL, 10, '2026-01-03', { price: 50_000 }), {
      id: 'op2',
      legId: 'leg2',
    }).state
    const spent = { ...sold, pesos: { movements: [...sold.pesos.movements, { id: 'e', type: TransactionType.SELL, amount: 1_200_000, date: day('2026-01-04') }] } }
    expect(() => applyRemoveCedearTransaction(spent, 'op2')).toThrow(
      'No se puede eliminar: el egreso de pesos del 04/01/2026 quedaría sin saldo.',
    )
  })

  it('la pata no se borra desde Pesos ni desde el Dólar', () => {
    const viaPesos = buy().state
    expect(() => applyRemovePesosMovement(viaPesos.pesos, 'leg')).toThrow('modificala desde CEDEARs')
    const viaCcl = buy(funded, { currency: 'CCL', price: 13 }).state
    expect(() => applyRemoveTransaction(viaCcl.dolar, 'leg')).toThrow('modificala desde CEDEARs')
  })

  it('null si no existe', () => {
    expect(applyRemoveCedearTransaction(funded, 'x')).toBeNull()
  })
})
