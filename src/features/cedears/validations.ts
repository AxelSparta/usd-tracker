import { endOfDay } from 'date-fns'
import { z } from 'zod'
import { TransactionType } from '@/types/transaction.types'
import { CEDEAR_TICKER } from './catalog'

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
