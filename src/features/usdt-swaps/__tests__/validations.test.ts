import { describe, expect, it } from 'vitest'
import { swapFormSchema, USDT_OPTION_ID } from '@/features/usdt-swaps/validations'

const swap = {
  fromCoinId: 'bitcoin',
  fromQuantity: '0,5',
  toCoinId: 'ethereum',
  toQuantity: '10',
  valueUsd: '30.000',
  arsRate: '',
  fee: '',
  feeCurrency: 'USDT' as const,
  date: new Date('2026-01-01T00:00:00'),
}

const issues = (input: unknown) => {
  const result = swapFormSchema.safeParse(input)
  return result.success ? [] : result.error.issues.map((i) => i.path.join('.'))
}

describe('swapFormSchema', () => {
  it('cripto ↔ cripto: pide el valor en USD, no la cotización', () => {
    expect(issues(swap)).toEqual([])
    expect(issues({ ...swap, valueUsd: '' })).toEqual(['valueUsd'])
  })

  it('rechaza lo mismo en ambos lados', () => {
    expect(issues({ ...swap, toCoinId: 'bitcoin' })).toEqual(['toCoinId'])
  })

  it('con USDT: pide la cotización y no el valor en USD', () => {
    const usdt = { ...swap, fromCoinId: USDT_OPTION_ID, fromQuantity: '600', valueUsd: '' }
    expect(issues(usdt)).toEqual(['arsRate'])
    expect(issues({ ...usdt, arsRate: '1.500' })).toEqual([])
  })

  it('valida la comisión como número', () => {
    expect(issues({ ...swap, fee: 'abc' })).toEqual(['fee'])
  })
})
