import { endOfDay } from 'date-fns'
import { z } from 'zod'
import { parseLocaleAmount } from '@/lib/locale-amount'
import { TRADE_RESULT, TransactionType } from '@/types/transaction.types'
import { operationKindFields } from '@/validations/transaction'
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


// --- Body de la API (`/api/crypto/*`): montos ya numéricos y fecha ISO ---

const apiDateField = z.coerce
  .date({ error: () => 'La fecha es requerida' })
  .refine((d) => d <= endOfDay(new Date()), 'La fecha no puede ser futura')

const positiveNumber = (label: string) =>
  z.number().finite().positive(`${label} debe ser mayor a cero`)

/** ids de CoinGecko: minúsculas, dígitos y guiones (ej. `bitcoin`, `usd-coin`) */
export const coinIdField = z.string().regex(/^[a-z0-9-]{1,100}$/, 'Moneda inválida')

export const coinApiSchema = z.object({
  id: coinIdField,
  symbol: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  image: z.url().max(2000).nullable(),
})

export const cryptoTransactionFields = z.object({
  coinId: coinIdField,
  type: z.enum(TransactionType),
  quantity: positiveNumber('La cantidad'),
  priceUsd: positiveNumber('El precio'),
  date: apiDateField,
  fee: z
    .object({
      amount: positiveNumber('La comisión'),
      currency: z.enum(['USD', 'COIN']),
    })
    .optional(),
  ...operationKindFields,
})

const coinMatches = {
  check: (d: { transaction: { coinId: string }; coin: { id: string } }) =>
    d.transaction.coinId === d.coin.id,
  params: { path: ['coin'], message: 'La moneda no coincide con la operación' },
}

/** Edición */
export const cryptoTransactionApiSchema = z
  .object({ transaction: cryptoTransactionFields, coin: coinApiSchema })
  .refine(coinMatches.check, coinMatches.params)

/** Alta: el id lo genera el cliente (`crypto.randomUUID()`) */
export const createCryptoTransactionApiSchema = z
  .object({
    transaction: cryptoTransactionFields.extend({ id: z.uuid('Id inválido') }),
    coin: coinApiSchema,
  })
  .refine(coinMatches.check, coinMatches.params)

export const cryptoSwapApiSchema = z.object({
  swap: z.object({
    from: coinApiSchema,
    fromQuantity: positiveNumber('La cantidad'),
    to: coinApiSchema,
    toQuantity: positiveNumber('La cantidad'),
    valueUsd: positiveNumber('El valor'),
    date: apiDateField,
  }),
  ids: z.object({
    swapId: z.uuid('Id inválido'),
    sellId: z.uuid('Id inválido'),
    buyId: z.uuid('Id inválido'),
  }),
})

// --- Resultado de trade en una moneda (Fase 7b) ---

export const cryptoTradeResultFormSchema = z.object({
  /** BUY = ganancia, SELL = pérdida */
  type: z.enum(TransactionType),
  quantity: positiveAmountField('La cantidad'),
  /** Precio de la moneda ese día: valúa el resultado (la ganancia entra a ese costo) */
  priceUsd: positiveAmountField('El precio'),
  note: z.string().max(200, 'La nota puede tener hasta 200 caracteres'),
  date: dateField,
})

export type CryptoTradeResultFormInput = z.infer<typeof cryptoTradeResultFormSchema>

export const parseCryptoTradeResultFormInput = (data: CryptoTradeResultFormInput, coinId: string) => {
  const note = data.note.trim()
  return {
    coinId,
    type: data.type,
    quantity: parseLocaleAmount(data.quantity),
    priceUsd: parseLocaleAmount(data.priceUsd),
    date: data.date,
    kind: TRADE_RESULT,
    ...(note && { note }),
  }
}
