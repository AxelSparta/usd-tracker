import { describe, expect, it } from 'vitest'
import { Prisma } from '@/generated/prisma/client'
import {
  toCoin,
  toCryptoTransaction,
  toCryptoTransactionData,
  toDolarTransaction,
  toDolarTransactionData,
} from '@/server/mappers'
import { DolarOption } from '@/types/dolar.types'
import { TransactionType } from '@/types/transaction.types'

const date = new Date('2026-01-01T03:00:00Z')
const meta = { userId: 'user_1', createdAt: date, updatedAt: date }

const cryptoRow = {
  ...meta,
  id: 'c1',
  coinId: 'bitcoin',
  symbol: 'BTC',
  name: 'Bitcoin',
  image: null,
  type: 'BUY' as const,
  quantity: new Prisma.Decimal('0.123456789012345678'),
  priceUsd: new Prisma.Decimal('65000.5'),
  date,
  feeAmount: null,
  feeCurrency: null,
  swapId: null,
  usdtSwapId: null,
}

describe('mappers', () => {
  it('convierte Decimal → number en el dólar', () => {
    const tx = toDolarTransaction({
      ...meta,
      id: 'd1',
      dolarOption: 'blue',
      type: 'SELL',
      dollarsAmount: new Prisma.Decimal('100.25'),
      pesosAmount: new Prisma.Decimal('130325.5'),
      date,
      usdtSwapId: null,
    })
    expect(tx).toEqual({
      id: 'd1',
      type: TransactionType.SELL,
      dollarsAmount: 100.25,
      pesosAmount: 130325.5,
      date,
      dolarOption: 'blue',
    })
  })

  it('omite fee y los enlaces de intercambio cuando son null (como en local)', () => {
    const tx = toCryptoTransaction(cryptoRow)
    expect(tx).not.toHaveProperty('fee')
    expect(tx).not.toHaveProperty('swapId')
    expect(tx).not.toHaveProperty('usdtSwapId')
    expect(tx.quantity).toBeCloseTo(0.123456789012345678, 15)
    expect(toCoin(cryptoRow)).toEqual({ id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', image: null })
  })

  it('ida y vuelta con comisión e intercambio', () => {
    const data = toCryptoTransactionData(
      {
        coinId: 'bitcoin',
        type: TransactionType.SELL,
        quantity: 0.5,
        priceUsd: 60_000,
        date: '2026-01-01T03:00:00.000Z',
        fee: { amount: 0.001, currency: 'COIN' },
        swapId: 's1',
      },
      { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', image: null },
    )
    expect(data.date).toEqual(date)
    const tx = toCryptoTransaction({
      ...cryptoRow,
      ...data,
      quantity: new Prisma.Decimal(data.quantity),
      priceUsd: new Prisma.Decimal(data.priceUsd),
      feeAmount: new Prisma.Decimal(data.feeAmount!),
    })
    expect(tx.fee).toEqual({ amount: 0.001, currency: 'COIN' })
    expect(tx.swapId).toBe('s1')
  })

  it('ida y vuelta del enlace de un intercambio USDT', () => {
    const dolarData = toDolarTransactionData({
      type: TransactionType.SELL,
      dollarsAmount: 600,
      pesosAmount: 900_000,
      date,
      dolarOption: DolarOption.Cripto,
      usdtSwapId: 'u1',
    })
    expect(dolarData.usdtSwapId).toBe('u1')
    const dolar = toDolarTransaction({
      ...meta,
      ...dolarData,
      id: 'd2',
      dollarsAmount: new Prisma.Decimal(600),
      pesosAmount: new Prisma.Decimal(900_000),
    })
    expect(dolar.usdtSwapId).toBe('u1')
    expect(toCryptoTransaction({ ...cryptoRow, usdtSwapId: 'u1' }).usdtSwapId).toBe('u1')
  })
})
