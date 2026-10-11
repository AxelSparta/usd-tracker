import { endOfDay } from 'date-fns'
import { z } from 'zod'
import { parseLocaleAmount } from '@/lib/locale-amount'
import { TransactionType } from '@/types/transaction.types'
import { CEDEAR_TICKER } from './catalog'
import type { CedearTransaction } from './types'

// --- Body de la API (`/api/cedears/transactions`): montos numéricos y fecha ISO ---

/** Operación sin id; la regla de saldos y unidades la validan las funciones puras (422) */
export const cedearTransactionApiSchema = z.object({
  ticker: z
    .string()
    .trim()
    .toUpperCase()
    .regex(CEDEAR_TICKER, 'Ticker inválido'),
  type: z.enum(TransactionType),
  quantity: z
    .number()
    .int('La cantidad debe ser un número entero de CEDEARs')
    .positive('La cantidad debe ser mayor a cero'),
  price: z.number().finite().positive('El precio debe ser mayor a cero'),
  currency: z.enum(['ARS', 'CCL']),
  fxRate: z.number().finite().positive('El CCL debe ser mayor a cero'),
  fee: z.number().finite().nonnegative('La comisión no puede ser negativa').optional(),
  date: z.coerce
    .date({ error: () => 'La fecha es requerida' })
    .refine((d) => d <= endOfDay(new Date()), 'La fecha no puede ser futura'),
})

/** Alta: el cliente genera el id de la operación y el de su pata (`crypto.randomUUID()`) */
export const createCedearTransactionApiSchema = cedearTransactionApiSchema.extend({
  id: z.uuid('Id inválido'),
  legId: z.uuid('Id inválido'),
})

// --- Formulario (montos como texto con formato AR: miles `.`, decimales `,`) ---

const positiveText = (label: string) =>
  z
    .string()
    .min(1, `${label} es requerido`)
    .refine((s) => Number.isFinite(parseLocaleAmount(s)), 'Ingresá un número válido')
    .refine((s) => parseLocaleAmount(s) > 0, `${label} debe ser mayor a cero`)

const parseOptional = (s: string) => (s.trim() ? parseLocaleAmount(s) : 0)

export const cedearTransactionFormSchema = z
  .object({
    ticker: z.string().min(1, 'Elegí un CEDEAR'),
    type: z.enum(TransactionType),
    quantity: positiveText('La cantidad').refine(
      (s) => Number.isInteger(parseLocaleAmount(s)),
      'La cantidad debe ser un número entero de CEDEARs',
    ),
    currency: z.enum(['ARS', 'CCL']),
    price: positiveText('El precio'),
    fxRate: positiveText('El CCL'),
    /** Vacío = sin comisión */
    fee: z
      .string()
      .refine((s) => !s.trim() || Number.isFinite(parseLocaleAmount(s)), 'Ingresá un número válido')
      .refine((s) => parseOptional(s) >= 0, 'La comisión no puede ser negativa'),
    date: z
      .date({ error: () => 'La fecha es requerida' })
      .refine((d) => d <= endOfDay(new Date()), 'La fecha no puede ser futura'),
  })
  .refine(
    (d) =>
      !(
        d.type === TransactionType.SELL &&
        parseOptional(d.fee) >= parseLocaleAmount(d.quantity) * parseLocaleAmount(d.price)
      ),
    { path: ['fee'], message: 'La comisión no puede superar el total de la venta' },
  )

export type CedearTransactionFormInput = z.infer<typeof cedearTransactionFormSchema>

export const parseCedearTransactionFormInput = (
  data: CedearTransactionFormInput,
): Omit<CedearTransaction, 'id'> => {
  const fee = parseOptional(data.fee)
  return {
    ticker: data.ticker,
    type: data.type,
    quantity: parseLocaleAmount(data.quantity),
    price: parseLocaleAmount(data.price),
    currency: data.currency,
    fxRate: parseLocaleAmount(data.fxRate),
    date: data.date,
    ...(fee > 0 && { fee }),
  }
}
