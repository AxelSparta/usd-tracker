import type { TransactionType } from '@/types/transaction.types'

/** CEDEAR del panel de BYMA (ticker base, en ARS): lo que devuelve el buscador. */
export type Cedear = {
  /** Ticker base en ARS, ej. `AAPL`, `BA.C` (Bank of America) */
  ticker: string
  /** Nombre del subyacente si está en el catálogo; si no, `null` y se muestra solo el ticker */
  name: string | null
}

export type CedearPrice = {
  /** Último precio en ARS; `null` si el panel lo informa en 0 (sin operaciones) */
  priceArs: number | null
  /** Variación % del día */
  change24h: number | null
  /** Epoch en ms de cuándo data912 armó el panel (el panel no trae fecha) */
  updatedAt: number | null
}

export type CedearPriceMap = Record<string, CedearPrice>

/** Cierre diario en ARS. Sin ajustar por cambios de ratio (ver `docs/roadmap-cedears.md`, 9.1). */
export type CedearHistoryPoint = { date: string; ars: number }

/** Con qué se paga o se cobra una operación: ARS → pata en Pesos; CCL → pata en el Dólar CCL */
export type CedearCurrency = 'ARS' | 'CCL'

/** Lo que la regla de patas (`assertCedearLegsComplete`) necesita de una operación de CEDEAR */
export type CedearLegOwner = { id: string; type: TransactionType; currency: CedearCurrency }

/**
 * Compra o venta de CEDEARs (Fase 9.2). Su pata (movimiento de Pesos u operación del Dólar CCL)
 * guarda este `id` como `cedearId` (D8) y se crea, edita y borra junto con ella (D6).
 */
export type CedearTransaction = {
  id: string
  /** Ticker base en BYMA, ej. `AAPL`, `BA.C` */
  ticker: string
  type: TransactionType
  /** CEDEARs enteros, > 0 */
  quantity: number
  /** Por CEDEAR, en `currency` (ARS, o USD CCL) */
  price: number
  currency: CedearCurrency
  /** ARS por USD CCL ese día (CCL venta por defecto, D4): da el monto en la otra moneda */
  fxRate: number
  /** Comisión + derechos, en `currency`: encarece la compra y reduce lo cobrado en la venta */
  fee?: number
  /** `Date` al crearla; string ISO tras rehidratar desde `localStorage` */
  date: Date | string
}

export type CedearState = {
  /** Lista plana ordenada con `sortTxs` */
  transactions: CedearTransaction[]
}

/** Posición por ticker, en ARS y en USD (D4). "Costo" = costo base de lo que queda abierto. */
export type CedearPosition = {
  ticker: string
  quantity: number
  costArs: number
  costUsd: number
  averageCostArs: number
  averageCostUsd: number
  realizedPnlArs: number
  realizedPnlUsd: number
  /** Último precio ARS del ticker base; `null` sin precio */
  priceArs: number | null
  change24h: number | null
  /** `null` sin precio (D5) */
  marketValueArs: number | null
  /** Valor ARS / CCL venta; `null` sin precio o sin CCL */
  marketValueUsd: number | null
  unrealizedPnlArs: number | null
  unrealizedPnlUsd: number | null
}

export type CedearSummary = {
  costArs: number
  costUsd: number
  /** Suman solo las posiciones con precio (y CCL, en USD) */
  marketValueArs: number
  marketValueUsd: number
  unrealizedPnlArs: number
  unrealizedPnlUsd: number
  realizedPnlArs: number
  realizedPnlUsd: number
  /** Alguna posición abierta no tiene precio (o falta el CCL para pasarla a USD) */
  hasMissingPrices: boolean
}
