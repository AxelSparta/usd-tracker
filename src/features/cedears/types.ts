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
