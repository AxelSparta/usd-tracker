import { endOfDay } from 'date-fns'
import { z } from 'zod'
import { coinApiSchema } from '@/features/crypto/validations'
import { parseLocaleAmount } from '@/lib/locale-amount'

/** Body de `POST /api/usdt-swaps`: montos ya numéricos y fecha ISO (mismas reglas que el form) */

const positiveNumber = (label: string) =>
  z.number().finite().positive(`${label} debe ser mayor a cero`)

export const usdtSwapApiSchema = z.object({
  swap: z.object({
    direction: z.enum(['USDT_TO_COIN', 'COIN_TO_USDT']),
    coin: coinApiSchema,
    quantity: positiveNumber('La cantidad'),
    usdt: positiveNumber('La cantidad de USDT'),
    fee: z
      .object({ amount: positiveNumber('La comisión'), currency: z.enum(['USDT', 'COIN']) })
      .optional(),
    arsRate: positiveNumber('La cotización'),
    date: z.coerce
      .date({ error: () => 'La fecha es requerida' })
      .refine((d) => d <= endOfDay(new Date()), 'La fecha no puede ser futura'),
  }),
  ids: z.object({
    usdtSwapId: z.uuid('Id inválido'),
    dolarId: z.uuid('Id inválido'),
    cryptoId: z.uuid('Id inválido'),
  }),
})

// --- Formulario de intercambio (`SwapForm`): cripto ↔ cripto o USDT ↔ cripto ---

/** Opción fija del selector: los USDT del módulo Dólar (grupo `cripto`), no una moneda de CoinGecko */
export const USDT_OPTION_ID = 'usdt-dolar-cripto'

const amountText = z
  .string()
  .refine((s) => !s.trim() || Number.isFinite(parseLocaleAmount(s)), 'Ingresá un número válido')

const positiveText = (label: string) =>
  z
    .string()
    .min(1, `${label} es requerido`)
    .refine((s) => Number.isFinite(parseLocaleAmount(s)), 'Ingresá un número válido')
    .refine((s) => parseLocaleAmount(s) > 0, `${label} debe ser mayor a cero`)

const isPositive = (s: string) => parseLocaleAmount(s) > 0

export const swapFormSchema = z
  .object({
    fromCoinId: z.string().min(1, 'Elegí lo que entregás'),
    fromQuantity: positiveText('La cantidad'),
    toCoinId: z.string().min(1, 'Elegí lo que recibís'),
    toQuantity: positiveText('La cantidad'),
    /** Solo cripto ↔ cripto (con USDT, el valor es la cantidad de USDT) */
    valueUsd: amountText,
    /** Solo con USDT: pesos por USDT */
    arsRate: amountText,
    /** Solo con USDT; vacío = sin comisión */
    fee: amountText,
    feeCurrency: z.enum(['USDT', 'COIN']),
    date: z
      .date({ error: () => 'La fecha es requerida' })
      .refine((d) => d <= endOfDay(new Date()), 'La fecha no puede ser futura'),
  })
  .superRefine((d, ctx) => {
    if (d.fromCoinId && d.fromCoinId === d.toCoinId) {
      ctx.addIssue({ code: 'custom', path: ['toCoinId'], message: 'Elegí algo distinto a lo que entregás' })
    }
    const withUsdt = d.fromCoinId === USDT_OPTION_ID || d.toCoinId === USDT_OPTION_ID
    if (!withUsdt && !isPositive(d.valueUsd)) {
      ctx.addIssue({ code: 'custom', path: ['valueUsd'], message: 'El valor debe ser mayor a cero' })
    }
    if (withUsdt && !isPositive(d.arsRate)) {
      ctx.addIssue({ code: 'custom', path: ['arsRate'], message: 'Ingresá la cotización del dólar cripto' })
    }
  })

export type SwapFormInput = z.infer<typeof swapFormSchema>
