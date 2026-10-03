import { describe, expect, it } from 'vitest'
import {
  applyAddTransaction,
  applyRemoveTransaction,
  applyUpdateTransaction,
  groupTransactions,
} from '@/domain/transactions'
import { DolarOption } from '@/types/dolar.types'
import { TransactionType, type Transaction } from '@/types/transaction.types'

const tx = (
  id: string,
  type: TransactionType,
  dollarsAmount: number,
  date: string,
  dolarOption = DolarOption.Blue,
): Transaction => ({
  id,
  type,
  dollarsAmount,
  pesosAmount: dollarsAmount * 1000,
  date: new Date(`${date}T00:00:00`),
  dolarOption,
})

describe('groupTransactions', () => {
  it('agrupa por tipo de dólar y ordena cada grupo', () => {
    const groups = groupTransactions([
      tx('b', TransactionType.SELL, 50, '2026-02-01'),
      tx('o', TransactionType.BUY, 10, '2026-01-01', DolarOption.Oficial),
      tx('a', TransactionType.BUY, 100, '2026-01-01'),
    ])
    expect(groups.blue?.map((t) => t.id)).toEqual(['a', 'b'])
    expect(groups.oficial?.map((t) => t.id)).toEqual(['o'])
  })
})

describe('operaciones del dólar', () => {
  const base = groupTransactions([
    tx('buy', TransactionType.BUY, 100, '2026-01-01'),
    tx('sell', TransactionType.SELL, 100, '2026-02-01'),
  ])

  it('no modifica el estado recibido', () => {
    applyAddTransaction(base, tx('new', TransactionType.BUY, 1, '2026-03-01'))
    expect(base.blue).toHaveLength(2)
  })

  it('rechaza un alta que deja el saldo negativo', () => {
    expect(() =>
      applyAddTransaction(base, tx('x', TransactionType.SELL, 1, '2026-03-01')),
    ).toThrow('El saldo de USD quedaría negativo el 01/03/2026.')
  })

  it('edición y borrado devuelven null si la operación no existe', () => {
    const { id, ...data } = tx('x', TransactionType.BUY, 1, '2026-03-01')
    expect(applyUpdateTransaction(base, 'nope', data)).toBeNull()
    expect(applyRemoveTransaction(base, 'nope')).toBeNull()
  })

  it('al cambiar de tipo de dólar valida también el grupo de origen', () => {
    const { id, ...data } = tx('buy', TransactionType.BUY, 100, '2026-01-01', DolarOption.Oficial)
    expect(() => applyUpdateTransaction(base, 'buy', data)).toThrow(/negativo el 01\/02\/2026/)
  })

  it('rechaza borrar la compra que respalda una venta', () => {
    expect(() => applyRemoveTransaction(base, 'buy')).toThrow(/negativo/)
    expect(applyRemoveTransaction(base, 'sell')?.blue).toHaveLength(1)
  })
})
