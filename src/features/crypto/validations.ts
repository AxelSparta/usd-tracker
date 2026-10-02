import { endOfDay } from 'date-fns'
import { z } from 'zod'
import { parseLocaleAmount } from '@/lib/locale-amount'
import { TransactionType } from '@/types/transaction.types'
import type { CryptoFee } from './types'

const positiveAmountField = (label: string) =>
  z
    .string()
    .min(1, `${label} es requerido`)
    .refine((s) => Number.isFinite(parseLocaleAmount(s)), 'Ingresá un número válido')
    .refine((s) => parseLocaleAmount(s) > 0, `${label} debe ser mayor a cero`)

const dateField = z
  .date({ error: () => 'La fecha es requerida' })
  .refine((d) => d <= endOfDay(new Date()), 'La fecha no puede ser futura')

/** Vacío = sin comisión */
const optionalAmountField = z
  .string()
  .refine(
    (s) => !s.trim() || Number.isFinite(parseLocaleAmount(s)),
    'Ingresá un número válido',
  )

const parseOptional = (s: string) => (s.trim() ? parseLocaleAmount(s) : 0)

export const cryptoTransactionFormSchema = z
  .object({
    coinId: z.string().min(1, 'Elegí una moneda'),
    type: z.enum(TransactionType),
    quantity: positiveAmountField('La cantidad'),
    priceUsd: positiveAmountField('El precio'),
    fee: optionalAmountField,
    feeCurrency: z.enum(['USD', 'COIN']),
    date: dateField,
  })
  .refine(
    (d) =>
      !(
        d.type === TransactionType.BUY &&
        d.feeCurrency === 'COIN' &&
        parseOptional(d.fee) >= parseLocaleAmount(d.quantity)
      ),
    { path: ['fee'], message: 'La comisión no puede superar la cantidad comprada' },
  )
  .refine(
    (d) =>
      !(
        d.type === TransactionType.SELL &&
        d.feeCurrency === 'USD' &&
        parseOptional(d.fee) > parseLocaleAmount(d.quantity) * parseLocaleAmount(d.priceUsd)
      ),
    { path: ['fee'], message: 'La comisión no puede superar el total de la venta' },
  )

/** Valores del formulario (montos como texto con formato AR). */
export type CryptoTransactionFormInput = z.infer<typeof cryptoTransactionFormSchema>

export const parseCryptoTransactionFormInput = (
  data: CryptoTransactionFormInput,
) => {
  const feeAmount = parseOptional(data.fee)
  const fee: CryptoFee | undefined =
    feeAmount > 0 ? { amount: feeAmount, currency: data.feeCurrency } : undefined

  return {
    coinId: data.coinId,
    type: data.type,
    quantity: parseLocaleAmount(data.quantity),
    priceUsd: parseLocaleAmount(data.priceUsd),
    date: data.date,
    ...(fee && { fee }),
  }
}

export const cryptoSwapFormSchema = z
  .object({
    fromCoinId: z.string().min(1, 'Elegí la moneda que entregás'),
    fromQuantity: positiveAmountField('La cantidad'),
    toCoinId: z.string().min(1, 'Elegí la moneda que recibís'),
    toQuantity: positiveAmountField('La cantidad'),
    valueUsd: positiveAmountField('El valor'),
    date: dateField,
  })
  .refine((d) => !d.fromCoinId || d.fromCoinId !== d.toCoinId, {
    path: ['toCoinId'],
    message: 'Elegí una moneda distinta a la que entregás',
  })

export type CryptoSwapFormInput = z.infer<typeof cryptoSwapFormSchema>
