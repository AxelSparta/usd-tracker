import { formatCurrency } from '@/lib/locale-amount'

/** Moneda en la que se muestran las métricas (D4: la posición se sigue en las dos) */
export type ViewCurrency = 'ARS' | 'USD'

const prefix = (currency: ViewCurrency) => (currency === 'ARS' ? '$' : 'US$')

export const money = (currency: ViewCurrency, n: number) => `${prefix(currency)}${formatCurrency(n)}`

export const signedMoney = (currency: ViewCurrency, n: number) =>
  `${n < 0 ? '-' : ''}${prefix(currency)}${formatCurrency(Math.abs(n))}`

type Amounts = {
  costArs: number
  costUsd: number
  marketValueArs: number | null
  marketValueUsd: number | null
  unrealizedPnlArs: number | null
  unrealizedPnlUsd: number | null
  realizedPnlArs: number
  realizedPnlUsd: number
}

/** Las métricas de una posición (o del resumen) en la moneda elegida */
export const inCurrency = (amounts: Amounts, currency: ViewCurrency) =>
  currency === 'ARS'
    ? {
        cost: amounts.costArs,
        marketValue: amounts.marketValueArs,
        unrealized: amounts.unrealizedPnlArs,
        realized: amounts.realizedPnlArs,
      }
    : {
        cost: amounts.costUsd,
        marketValue: amounts.marketValueUsd,
        unrealized: amounts.unrealizedPnlUsd,
        realized: amounts.realizedPnlUsd,
      }
