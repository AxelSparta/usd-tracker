import { endOfDay } from 'date-fns'
import { z } from 'zod'
import { parseLocaleAmount } from '@/lib/locale-amount'
import { TransactionType } from '@/types/transaction.types'

const positiveAmountField = (label: string) =>
  z
    .string()
    .min(1, `${label} es requerido`)
    .refine((s) => Number.isFinite(parseLocaleAmount(s)), 'Ingresá un número válido')
    .refine((s) => parseLocaleAmount(s) > 0, `${label} debe ser mayor a cero`)

export const cryptoTransactionFormSchema = z.object({
  coinId: z.string().min(1, 'Elegí una moneda'),
  type: z.enum(TransactionType),
  quantity: positiveAmountField('La cantidad'),
  priceUsd: positiveAmountField('El precio'),
  date: z
    .date({ error: () => 'La fecha es requerida' })
    .refine((d) => d <= endOfDay(new Date()), 'La fecha no puede ser futura'),
})

/** Valores del formulario (montos como texto con formato AR). */
export type CryptoTransactionFormInput = z.infer<typeof cryptoTransactionFormSchema>

export const parseCryptoTransactionFormInput = (
  data: CryptoTransactionFormInput,
) => ({
  coinId: data.coinId,
  type: data.type,
  quantity: parseLocaleAmount(data.quantity),
  priceUsd: parseLocaleAmount(data.priceUsd),
  date: data.date,
})
