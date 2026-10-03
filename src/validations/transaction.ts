import { parseLocaleAmount } from '@/lib/locale-amount'
import { DolarOption } from '@/types/dolar.types'
import { TRADE_RESULT, TransactionType } from '@/types/transaction.types'
import { endOfDay } from 'date-fns'
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
  date: z
    .date({ error: () => 'La fecha es requerida' })
    .refine((d) => d <= endOfDay(new Date()), 'La fecha no puede ser futura'),
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

/** `kind` y `note` de un resultado de trade (Fase 7b); la forma la validan las funciones puras */
export const operationKindFields = {
  kind: z.literal(TRADE_RESULT).optional(),
  note: z.string().trim().max(200, 'La nota puede tener hasta 200 caracteres').optional(),
}

/**
 * Body de la API (`/api/dolar/transactions`): montos ya numéricos y fecha ISO.
 * Mismas reglas que el formulario, para que el server no dependa del cliente.
 */
export const transactionApiSchema = z.object({
  type: z.enum(TransactionType),
  pesosAmount: z.number().finite().min(0, 'La cantidad de pesos no puede ser negativa'),
  dollarsAmount: z.number().finite().positive('La cantidad de dólares debe ser mayor a cero'),
  date: z.coerce
    .date({ error: () => 'La fecha es requerida' })
    .refine((d) => d <= endOfDay(new Date()), 'La fecha no puede ser futura'),
  dolarOption: z.enum(DolarOption),
  ...operationKindFields,
})

/** Alta: el id lo genera el cliente (`crypto.randomUUID()`) */
export const createTransactionApiSchema = transactionApiSchema.extend({
  id: z.uuid('Id inválido'),
})

// --- Resultado de trade en USDT (dólar cripto, Fase 7b) ---

const noteField = z.string().max(200, 'La nota puede tener hasta 200 caracteres')

export const tradeResultFormSchema = z.object({
  /** BUY = ganancia, SELL = pérdida */
  type: z.enum(TransactionType),
  dollarsAmount: z
    .string()
    .min(1, 'La cantidad de USDT es requerida')
    .refine((s) => Number.isFinite(parseLocaleAmount(s)), 'Ingresá un número válido')
    .refine((s) => parseLocaleAmount(s) > 0, 'La cantidad de USDT debe ser mayor a cero'),
  /** Pesos por USDT: valúa el resultado (la ganancia entra a ese costo) */
  arsRate: z
    .string()
    .min(1, 'Ingresá la cotización del dólar cripto')
    .refine((s) => parseLocaleAmount(s) > 0, 'La cotización debe ser mayor a cero'),
  note: noteField,
  date: z
    .date({ error: () => 'La fecha es requerida' })
    .refine((d) => d <= endOfDay(new Date()), 'La fecha no puede ser futura'),
})

export type TradeResultFormInput = z.infer<typeof tradeResultFormSchema>

export const parseTradeResultFormInput = (data: TradeResultFormInput) => {
  const dollarsAmount = parseLocaleAmount(data.dollarsAmount)
  const note = data.note.trim()
  return {
    type: data.type,
    dollarsAmount,
    pesosAmount: dollarsAmount * parseLocaleAmount(data.arsRate),
    date: data.date,
    dolarOption: DolarOption.Cripto,
    kind: TRADE_RESULT,
    ...(note && { note }),
  }
}
