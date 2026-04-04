import { parseLocaleAmount } from '@/lib/locale-amount'
import { DolarOption } from '@/types/dolar.types'
import { TransactionType } from '@/types/transaction.types'
import { z } from 'zod'

const pesosAmountField = z
  .string()
  .min(1, 'La cantidad de pesos es requerida')
  .refine((s) => Number.isFinite(parseLocaleAmount(s)), 'Ingresá un número válido')
  .refine((s) => parseLocaleAmount(s) >= 0, 'La cantidad de pesos no puede ser negativa')

const dollarsAmountField = z
  .string()
  .min(1, 'La cantidad de dólares es requerida')
  .refine((s) => Number.isFinite(parseLocaleAmount(s)), 'Ingresá un número válido')
  .refine((s) => parseLocaleAmount(s) > 0, 'La cantidad de dólares debe ser mayor a cero')

export const transactionFormSchema = z.object({
  pesosAmount: pesosAmountField,
  dollarsAmount: dollarsAmountField,
  date: z.date({ error: () => 'La fecha es requerida' }),
  type: z.enum(TransactionType),
  dolarOption: z.enum(DolarOption),
})

/** Valores del formulario (montos como texto con formato AR: miles `.`, decimales `,`). */
export type TransactionFormInput = z.infer<typeof transactionFormSchema>

/** Misma forma con montos numéricos (dominio / API). */
export type TransactionFormValues = Omit<
  TransactionFormInput,
  'pesosAmount' | 'dollarsAmount'
> & {
  pesosAmount: number
  dollarsAmount: number
}

export function parseTransactionFormInput(
  data: TransactionFormInput,
): TransactionFormValues {
  return {
    ...data,
    pesosAmount: parseLocaleAmount(data.pesosAmount),
    dollarsAmount: parseLocaleAmount(data.dollarsAmount),
  }
}
