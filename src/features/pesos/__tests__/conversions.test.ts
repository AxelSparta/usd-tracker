import { describe, expect, it } from 'vitest'
import { groupTransactions } from '@/domain/transactions'
import {
  applyAddConversion,
  applyRemoveConversion,
  assertConversionsComplete,
  buildConversionLegs,
  type ConversionInput,
} from '@/features/pesos/conversions'
import type { PesosMovement } from '@/features/pesos/types'
import { DolarOption } from '@/types/dolar.types'
import { TransactionType, type Transaction } from '@/types/transaction.types'

const day = (iso: string) => new Date(`${iso}T00:00:00`)
const ids = { conversionId: 'conv', pesosId: 'p-leg', dolarId: 'd-leg' }

const income: PesosMovement = { id: 'i', type: TransactionType.BUY, amount: 3_000_000, date: day('2026-01-01') }
const funded = { pesos: { movements: [income] }, dolar: {} }

const toBlue: ConversionInput = {
  direction: 'PESOS_TO_DOLAR',
  dolarOption: DolarOption.Blue,
  pesosAmount: 1_560_000,
  dollarsAmount: 1000,
  date: day('2026-02-01'),
}

describe('buildConversionLegs', () => {
  it('pesos → dólar: egreso de pesos + compra de USD con los mismos ARS', () => {
    const [pesosLeg, dolarLeg] = buildConversionLegs(toBlue, ids)
    expect(pesosLeg).toEqual({ id: 'p-leg', type: 'SELL', amount: 1_560_000, date: toBlue.date, conversionId: 'conv' })
    expect(dolarLeg).toEqual({
      id: 'd-leg',
      type: 'BUY',
      pesosAmount: 1_560_000,
      dollarsAmount: 1000,
      date: toBlue.date,
      dolarOption: 'blue',
      conversionId: 'conv',
    })
  })

  it('dólar → pesos: venta de USD + ingreso de pesos', () => {
    const [pesosLeg, dolarLeg] = buildConversionLegs({ ...toBlue, direction: 'DOLAR_TO_PESOS' }, ids)
    expect(pesosLeg.type).toBe('BUY')
    expect(dolarLeg.type).toBe('SELL')
  })
})

describe('applyAddConversion', () => {
  it('baja los pesos y agrega la compra al grupo del dólar', () => {
    const next = applyAddConversion(funded, toBlue, ids)
    expect(next.pesos.movements.map((m) => m.id)).toEqual(['i', 'p-leg'])
    expect(next.dolar.blue?.map((t) => t.id)).toEqual(['d-leg'])
  })

  it('rechaza convertir sin pesos suficientes a esa fecha', () => {
    expect(() => applyAddConversion(funded, { ...toBlue, date: day('2025-12-31') }, ids)).toThrow(
      'No tenés pesos suficientes para convertir el 31/12/2025.',
    )
  })

  it('rechaza vender dólares que no se tienen', () => {
    expect(() =>
      applyAddConversion(funded, { ...toBlue, direction: 'DOLAR_TO_PESOS', dolarOption: DolarOption.ContadoConLiqui }, ids),
    ).toThrow('No tenés suficientes USD CCL para convertir el 01/02/2026.')
  })

  it('dólar → pesos con saldo: los pesos cobrados se pueden gastar', () => {
    const withUsd = {
      pesos: { movements: [] },
      dolar: groupTransactions([
        { id: 'b', type: TransactionType.BUY, pesosAmount: 1_500_000, dollarsAmount: 1000, date: day('2026-01-01'), dolarOption: DolarOption.Blue },
      ]),
    }
    const next = applyAddConversion(withUsd, { ...toBlue, direction: 'DOLAR_TO_PESOS', dollarsAmount: 400, pesosAmount: 620_000 }, ids)
    expect(next.pesos.movements[0]).toMatchObject({ type: 'BUY', amount: 620_000 })
    expect(next.dolar.blue?.map((t) => t.type)).toEqual(['BUY', 'SELL'])
  })

  it('rechaza montos no positivos', () => {
    expect(() => applyAddConversion(funded, { ...toBlue, dollarsAmount: 0 }, ids)).toThrow(
      'Los montos deben ser mayores a cero.',
    )
  })
})

describe('applyRemoveConversion', () => {
  const converted = applyAddConversion(funded, toBlue, ids)

  it('borra las dos patas', () => {
    const result = applyRemoveConversion(converted, 'conv')
    expect(result?.removedIds.sort()).toEqual(['d-leg', 'p-leg'])
    expect(result?.state.pesos.movements.map((m) => m.id)).toEqual(['i'])
    expect(result?.state.dolar.blue).toEqual([])
  })

  it('null si no existe', () => {
    expect(applyRemoveConversion(converted, 'nada')).toBeNull()
  })

  it('no deja borrarla si los USD comprados ya se vendieron', () => {
    const sold: Transaction = {
      id: 's',
      type: TransactionType.SELL,
      pesosAmount: 900_000,
      dollarsAmount: 600,
      date: day('2026-03-01'),
      dolarOption: DolarOption.Blue,
    }
    const state = { ...converted, dolar: { blue: [...converted.dolar.blue!, sold] } }
    expect(() => applyRemoveConversion(state, 'conv')).toThrow(
      'No se puede eliminar: la venta de USD Blue del 01/03/2026 quedaría sin saldo.',
    )
  })

  it('no deja borrar una venta de USD si los pesos cobrados ya se gastaron', () => {
    const withUsd = {
      pesos: { movements: [] },
      dolar: groupTransactions([
        { id: 'b', type: TransactionType.BUY, pesosAmount: 1_500_000, dollarsAmount: 1000, date: day('2026-01-01'), dolarOption: DolarOption.Blue },
      ]),
    }
    const back = applyAddConversion(withUsd, { ...toBlue, direction: 'DOLAR_TO_PESOS' }, ids)
    const spent = {
      ...back,
      pesos: {
        movements: [...back.pesos.movements, { id: 'e', type: TransactionType.SELL, amount: 1_000_000, date: day('2026-03-01') }],
      },
    }
    expect(() => applyRemoveConversion(spent, 'conv')).toThrow(
      'No se puede eliminar: el egreso de pesos del 01/03/2026 quedaría sin saldo.',
    )
  })
})

describe('assertConversionsComplete', () => {
  const [pesosLeg, dolarLeg] = buildConversionLegs(toBlue, ids)

  it('acepta las dos patas enlazadas', () => {
    expect(() => assertConversionsComplete([dolarLeg], [pesosLeg])).not.toThrow()
  })

  it('rechaza una pata suelta, montos distintos o tipos iguales', () => {
    const message = 'Hay una conversión de pesos incompleta.'
    expect(() => assertConversionsComplete([dolarLeg], [])).toThrow(message)
    expect(() => assertConversionsComplete([], [pesosLeg])).toThrow(message)
    expect(() => assertConversionsComplete([{ ...dolarLeg, pesosAmount: 1 }], [pesosLeg])).toThrow(message)
    expect(() => assertConversionsComplete([dolarLeg], [{ ...pesosLeg, type: TransactionType.BUY }])).toThrow(message)
    expect(() => assertConversionsComplete([dolarLeg, { ...dolarLeg, id: 'x' }], [pesosLeg])).toThrow(message)
  })
})
