import { describe, expect, it } from 'vitest'
import {
  formatAmountArInput,
  formatPercent,
  formatPrice,
  formatQuantity,
  parseLocaleAmount,
} from '@/lib/locale-amount'

describe('parseLocaleAmount', () => {
  it.each([
    ['1.234,56', 1234.56],
    ['1000', 1000],
    ['0,5', 0.5],
    [' 12,3 ', 12.3],
  ])('%s → %d', (input, expected) => {
    expect(parseLocaleAmount(input)).toBe(expected)
  })

  it.each(['', ',', 'abc'])('%j → NaN', (input) => {
    expect(parseLocaleAmount(input)).toBeNaN()
  })
})

describe('formatAmountArInput', () => {
  it.each([
    ['1234', '1.234'],
    ['1234567,8', '1.234.567,8'],
    ['0012', '12'],
    [',5', '0,5'],
    ['12a3', '123'],
    ['1,2,3', '1,23'],
  ])('%s → %s', (input, expected) => {
    expect(formatAmountArInput(input)).toBe(expected)
  })
})

describe('formatPrice', () => {
  it.each([
    [65_432.1, '65.432,10'],
    [1, '1,00'],
    [0.5123, '0,5123'],
    [0.00001234, '0,00001234'],
    [0, '0,00'],
  ])('%d → %s', (input, expected) => {
    expect(formatPrice(input)).toBe(expected)
  })
})

describe('formatQuantity', () => {
  it.each([
    [0.5, '0,5'],
    [1250, '1.250'],
    [0.00012345, '0,00012345'],
  ])('%d → %s', (input, expected) => {
    expect(formatQuantity(input)).toBe(expected)
  })
})

describe('formatPercent', () => {
  it('muestra el signo', () => {
    expect(formatPercent(1.234)).toBe('+1,23%')
    expect(formatPercent(-4.5)).toBe('-4,50%')
    expect(formatPercent(0)).toBe('0,00%')
  })
})
