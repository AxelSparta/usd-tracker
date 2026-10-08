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
