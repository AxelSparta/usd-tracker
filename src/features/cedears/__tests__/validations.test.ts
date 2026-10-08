import { describe, expect, it } from 'vitest'
import { TransactionType } from '@/types/transaction.types'
import {
  cedearTransactionApiSchema,
  cedearTransactionFormSchema,
  parseCedearTransactionFormInput,
} from '../validations'

const form = {
  ticker: 'AAPL',
  type: TransactionType.BUY,
  quantity: '10',
  currency: 'ARS' as const,
  price: '26.000,50',
  fxRate: '1.600',
  fee: '',
  date: new Date('2026-02-01T12:00:00'),
}

const firstError = (data: unknown) =>
  cedearTransactionFormSchema.safeParse(data).error?.issues[0]?.message

describe('formulario de CEDEARs', () => {
  it('parsea los montos en formato AR y omite la comisión vacía', () => {
    expect(parseCedearTransactionFormInput(cedearTransactionFormSchema.parse(form))).toEqual({
      ticker: 'AAPL',
      type: TransactionType.BUY,
      quantity: 10,
      price: 26_000.5,
      currency: 'ARS',
      fxRate: 1600,
      date: form.date,
    })
    expect(parseCedearTransactionFormInput({ ...form, fee: '1.000' }).fee).toBe(1000)
  })

  it('rechaza cantidades no enteras y la comisión mayor al total de la venta', () => {
    expect(firstError({ ...form, quantity: '1,5' })).toBe(
      'La cantidad debe ser un número entero de CEDEARs',
    )
    expect(
      firstError({ ...form, type: TransactionType.SELL, quantity: '1', price: '100', fee: '100' }),
    ).toBe('La comisión no puede superar el total de la venta')
    expect(firstError({ ...form, ticker: '' })).toBe('Elegí un CEDEAR')
  })
})

describe('API de CEDEARs', () => {
  it('normaliza el ticker y rechaza los inválidos', () => {
    const { fee: _fee, ...rest } = form
    const body = { ...rest, quantity: 10, price: 1, fxRate: 1600, ticker: ' ba.c ' }
    expect(cedearTransactionApiSchema.parse(body).ticker).toBe('BA.C')
    expect(cedearTransactionApiSchema.safeParse({ ...body, ticker: 'AA PL' }).success).toBe(false)
  })
})
