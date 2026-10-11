import { describe, expect, it } from 'vitest'
import { assertCedearLegsComplete, CEDEAR_LEGS_INCOMPLETE } from '@/features/cedears/operations'
import type { CedearLegOwner } from '@/features/cedears/types'
import type { PesosMovement } from '@/features/pesos/types'
import { DolarOption } from '@/types/dolar.types'
import { TransactionType, type Transaction } from '@/types/transaction.types'

const date = '2026-10-01T03:00:00.000Z'
const pesosLeg = (cedearId: string, type = TransactionType.SELL): PesosMovement => ({
  id: `p-${cedearId}`,
  type,
  amount: 300_000,
  date,
  cedearId,
})
const cclLeg = (cedearId: string, type = TransactionType.SELL): Transaction => ({
  id: `d-${cedearId}`,
  type,
  pesosAmount: 152_000,
  dollarsAmount: 100,
  date,
  dolarOption: DolarOption.ContadoConLiqui,
  cedearId,
})
const buyArs: CedearLegOwner = { id: 'ars', type: TransactionType.BUY, currency: 'ARS' }
const sellCcl: CedearLegOwner = { id: 'ccl', type: TransactionType.SELL, currency: 'CCL' }

describe('assertCedearLegsComplete', () => {
  it('acepta una pata por operación, en el módulo de su moneda y del tipo contrario', () => {
    expect(() =>
      assertCedearLegsComplete(
        [buyArs, sellCcl],
        [cclLeg('ccl', TransactionType.BUY)],
        [pesosLeg('ars')],
      ),
    ).not.toThrow()
  })

  it('acepta datos sin CEDEARs', () => {
    expect(() => assertCedearLegsComplete([], [], [])).not.toThrow()
  })

  it('rechaza una pata sin operación', () => {
    expect(() => assertCedearLegsComplete([], [], [pesosLeg('x')])).toThrow(CEDEAR_LEGS_INCOMPLETE)
    expect(() => assertCedearLegsComplete([], [cclLeg('x')], [])).toThrow(CEDEAR_LEGS_INCOMPLETE)
  })

  it('rechaza una operación sin pata, con dos o en el módulo equivocado', () => {
    expect(() => assertCedearLegsComplete([buyArs], [], [])).toThrow(CEDEAR_LEGS_INCOMPLETE)
    expect(() =>
      assertCedearLegsComplete([buyArs], [], [pesosLeg('ars'), { ...pesosLeg('ars'), id: 'p2' }]),
    ).toThrow(CEDEAR_LEGS_INCOMPLETE)
    expect(() => assertCedearLegsComplete([buyArs], [cclLeg('ars')], [])).toThrow(
      CEDEAR_LEGS_INCOMPLETE,
    )
    expect(() =>
      assertCedearLegsComplete([buyArs], [cclLeg('ars')], [pesosLeg('ars')]),
    ).toThrow(CEDEAR_LEGS_INCOMPLETE)
  })

  it('rechaza una pata del mismo tipo que la operación', () => {
    expect(() =>
      assertCedearLegsComplete([buyArs], [], [pesosLeg('ars', TransactionType.BUY)]),
    ).toThrow(CEDEAR_LEGS_INCOMPLETE)
  })
})
