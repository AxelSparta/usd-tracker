import { describe, expect, it } from 'vitest'
import {
  cryptoSwapFormSchema,
  cryptoTransactionFormSchema,
  parseCryptoTransactionFormInput,
} from '@/features/crypto/validations'
import { TransactionType } from '@/types/transaction.types'

const base = {
  coinId: 'bitcoin',
  type: TransactionType.BUY,
  quantity: '1',
  priceUsd: '50.000',
  fee: '',
  feeCurrency: 'USD' as const,
  date: new Date('2026-01-01T00:00:00'),
}

describe('cryptoTransactionFormSchema: comisión', () => {
  it('vacía = sin comisión', () => {
    const parsed = parseCryptoTransactionFormInput(cryptoTransactionFormSchema.parse(base))
    expect(parsed).not.toHaveProperty('fee')
  })

  it('parsea la comisión en formato AR', () => {
    const parsed = parseCryptoTransactionFormInput(
      cryptoTransactionFormSchema.parse({ ...base, fee: '12,5' }),
    )
    expect(parsed.fee).toEqual({ amount: 12.5, currency: 'USD' })
  })

  it('rechaza una comisión en la moneda mayor o igual a lo comprado', () => {
    const result = cryptoTransactionFormSchema.safeParse({
      ...base,
      fee: '1',
      feeCurrency: 'COIN',
    })
    expect(result.success).toBe(false)
  })

  it('rechaza una comisión en USD mayor al total de la venta', () => {
    const result = cryptoTransactionFormSchema.safeParse({
      ...base,
      type: TransactionType.SELL,
      priceUsd: '10',
      fee: '11',
    })
    expect(result.success).toBe(false)
  })
})

describe('cryptoSwapFormSchema', () => {
  const swap = {
    fromCoinId: 'bitcoin',
    fromQuantity: '0,5',
    toCoinId: 'ethereum',
    toQuantity: '10',
    valueUsd: '30.000',
    date: new Date('2026-01-01T00:00:00'),
  }

  it('acepta un intercambio válido', () => {
    expect(cryptoSwapFormSchema.safeParse(swap).success).toBe(true)
  })

  it('rechaza la misma moneda en ambos lados', () => {
    const result = cryptoSwapFormSchema.safeParse({ ...swap, toCoinId: 'bitcoin' })
    expect(result.success).toBe(false)
  })
})
