import { describe, expect, it } from 'vitest'
import {
  applyAddPesosMovement,
  applyRemovePesosMovement,
  applyUpdatePesosMovement,
  computePesosBalance,
  CONVERSION_LEG_REMOVE,
  CONVERSION_LEG_UPDATE,
  validatePesosTimeline,
} from '@/features/pesos/operations'
import type { PesosMovement } from '@/features/pesos/types'
import { TransactionType } from '@/types/transaction.types'

const movement = (
  id: string,
  type: TransactionType,
  amount: number,
  date: string,
  extra: Partial<PesosMovement> = {},
): PesosMovement => ({ id, type, amount, date: new Date(`${date}T00:00:00`), ...extra })

const income = movement('i1', TransactionType.BUY, 1_000_000, '2026-01-01', { note: 'Sueldo' })
const expense = movement('e1', TransactionType.SELL, 400_000, '2026-02-01')
const funded = { movements: [income, expense] }

describe('computePesosBalance', () => {
  it('suma ingresos y resta egresos', () => {
    expect(computePesosBalance(funded.movements)).toBe(600_000)
    expect(computePesosBalance([])).toBe(0)
  })
})

describe('validatePesosTimeline', () => {
  it('el mismo día, los ingresos van antes que los egresos', () => {
    expect(() =>
      validatePesosTimeline([
        movement('e', TransactionType.SELL, 100, '2026-01-01'),
        movement('i', TransactionType.BUY, 100, '2026-01-01'),
      ]),
    ).not.toThrow()
  })

  it('lanza con la fecha del primer egreso sin saldo', () => {
    expect(() =>
      validatePesosTimeline([income, movement('e', TransactionType.SELL, 2_000_000, '2026-03-05')]),
    ).toThrow('No tenés pesos suficientes el 05/03/2026.')
  })
})

describe('applyAddPesosMovement', () => {
  it('agrega y deja la lista ordenada', () => {
    const early = movement('i0', TransactionType.BUY, 5, '2025-12-01')
    const { movements } = applyAddPesosMovement(funded, early)
    expect(movements.map((m) => m.id)).toEqual(['i0', 'i1', 'e1'])
  })

  it('rechaza un egreso sin saldo a esa fecha (aunque después entren pesos)', () => {
    const tooEarly = movement('e2', TransactionType.SELL, 10, '2025-12-31')
    expect(() => applyAddPesosMovement(funded, tooEarly)).toThrow(
      'No tenés pesos suficientes el 31/12/2025.',
    )
  })

  it('rechaza montos no positivos', () => {
    expect(() =>
      applyAddPesosMovement(funded, movement('x', TransactionType.BUY, 0, '2026-01-01')),
    ).toThrow('El monto debe ser mayor a cero.')
  })
})

describe('applyUpdatePesosMovement', () => {
  it('edita conservando el id', () => {
    const next = applyUpdatePesosMovement(funded, 'i1', {
      type: TransactionType.BUY,
      amount: 2_000_000,
      date: income.date,
    })
    expect(next?.movements.find((m) => m.id === 'i1')).toMatchObject({ amount: 2_000_000 })
    // Sin `note` en el cambio = se quitó la nota
    expect(next?.movements.find((m) => m.id === 'i1')?.note).toBeUndefined()
  })

  it('rechaza reducir un ingreso por debajo de lo gastado después', () => {
    expect(() =>
      applyUpdatePesosMovement(funded, 'i1', {
        type: TransactionType.BUY,
        amount: 100,
        date: income.date,
      }),
    ).toThrow('No tenés pesos suficientes para el egreso del 01/02/2026.')
  })

  it('null si no existe', () => {
    expect(applyUpdatePesosMovement(funded, 'nada', income)).toBeNull()
  })

  it('una pata de conversión no se edita', () => {
    const leg = movement('c1', TransactionType.BUY, 10, '2026-01-01', { conversionId: 'conv' })
    expect(() => applyUpdatePesosMovement({ movements: [leg] }, 'c1', leg)).toThrow(
      CONVERSION_LEG_UPDATE,
    )
  })
})

describe('applyRemovePesosMovement', () => {
  it('borra un egreso sin problemas', () => {
    expect(applyRemovePesosMovement(funded, 'e1')?.movements.map((m) => m.id)).toEqual(['i1'])
  })

  it('rechaza borrar un ingreso que deja un egreso sin saldo', () => {
    expect(() => applyRemovePesosMovement(funded, 'i1')).toThrow(
      'No se puede eliminar: el egreso del 01/02/2026 quedaría sin saldo.',
    )
  })

  it('null si no existe', () => {
    expect(applyRemovePesosMovement(funded, 'nada')).toBeNull()
  })

  it('una pata de conversión no se borra sola', () => {
    const leg = movement('c1', TransactionType.BUY, 10, '2026-01-01', { conversionId: 'conv' })
    expect(() => applyRemovePesosMovement({ movements: [leg] }, 'c1')).toThrow(
      CONVERSION_LEG_REMOVE,
    )
  })
})
