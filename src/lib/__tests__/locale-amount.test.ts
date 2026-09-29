import { describe, expect, it } from 'vitest'
import { formatAmountArInput, parseLocaleAmount } from '@/lib/locale-amount'

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
