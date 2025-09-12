import { TransactionType } from '@/types/transaction.types'
import { z } from 'zod'

export const transactionFormSchema = z.object({
  pesosAmount: z.union([
    z
      .number('La cantidad de pesos debe ser un número.')
      .nonnegative('La cantidad de pesos no puede ser un número negativo.'),
    z.nan()
  ]),
  dollarsAmount: z.union([
    z
      .number('La cantidad de dólares debe ser un número.')
      .nonnegative('La cantidad de dólares no puede ser un número negativo.'),
    z.nan()
  ]),
  date: z.date(),
  type: z.enum(TransactionType)
})