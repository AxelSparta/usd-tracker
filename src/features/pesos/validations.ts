import { endOfDay } from 'date-fns'
import { z } from 'zod'
import { parseLocaleAmount } from '@/lib/locale-amount'
import { TransactionType } from '@/types/transaction.types'
import type { PesosMovement } from './types'

const noteField = z.string().trim().max(200, 'La nota puede tener hasta 200 caracteres')

// --- Formulario (monto como texto con formato AR: miles `.`, decimales `,`) ---

export const pesosMovementFormSchema = z.object({
  /** BUY = ingreso, SELL = egreso */
  type: z.enum(TransactionType),
  amount: z
    .string()
    .min(1, 'El monto es requerido')
    .refine((s) => Number.isFinite(parseLocaleAmount(s)), 'Ingresá un número válido')
    .refine((s) => parseLocaleAmount(s) > 0, 'El monto debe ser mayor a cero'),
  note: noteField,
  date: z
    .date({ error: () => 'La fecha es requerida' })
    .refine((d) => d <= endOfDay(new Date()), 'La fecha no puede ser futura'),
})

export type PesosMovementFormInput = z.infer<typeof pesosMovementFormSchema>

export const parsePesosMovementFormInput = (
  data: PesosMovementFormInput,
): Omit<PesosMovement, 'id'> => {
  const note = data.note.trim()
  return {
    type: data.type,
    amount: parseLocaleAmount(data.amount),
    date: data.date,
    ...(note && { note }),
  }
}

// --- Body de la API (`/api/pesos/movements`): monto numérico y fecha ISO ---

/**
 * Sin `conversionId`: Zod descarta lo que no declara, así que esta API no crea ni
 * modifica patas de conversiones (solo las crea `/api/pesos/conversions`, 8.2).
 */
export const pesosMovementApiSchema = z.object({
  type: z.enum(TransactionType),
  amount: z.number().finite().positive('El monto debe ser mayor a cero'),
  date: z.coerce
    .date({ error: () => 'La fecha es requerida' })
    .refine((d) => d <= endOfDay(new Date()), 'La fecha no puede ser futura'),
  note: noteField.optional(),
})

/** Alta: el id lo genera el cliente (`crypto.randomUUID()`) */
export const createPesosMovementApiSchema = pesosMovementApiSchema.extend({
  id: z.uuid('Id inválido'),
})
