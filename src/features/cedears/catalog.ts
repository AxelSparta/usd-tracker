/**
 * Catálogo de CEDEARs: qué filas del panel de data912 son tickers base (en ARS) y el nombre del
 * subyacente de los más operados. Puro: lo usan el server y, más adelante, el cliente.
 */

/** Ticker de BYMA: letras y dígitos, con un sufijo opcional tras un punto (`BA.C`, `AKO.B`) */
export const CEDEAR_TICKER = /^[A-Z0-9]{1,10}(\.[A-Z0-9]{1,4})?$/

/** Un CEDEAR en ARS vale cientos o miles de pesos; sus variantes en USD, unos pocos dólares */
const MAX_USD_VARIANT_PRICE = 100

/** Precio en ARS / precio en USD de la misma especie: el CCL, muy por encima de 100 */
const MIN_ARS_TO_USD_RATIO = 100

/** El símbolo sin el sufijo de variante (`C` = USD CCL, `D` = USD MEP), si lo tiene */
const variantBase = (symbol: string): string | null => {
  if (/\.[CD]$/.test(symbol)) return symbol.slice(0, -2)
  if (symbol.length > 1 && /[CD]$/.test(symbol)) return symbol.slice(0, -1)
  return null
}

export type PanelRow = { symbol: string; c: number }

/**
 * Si la fila es una variante en USD (`AAPLC`, `BAC`, `C.D`) y no un CEDEAR en ARS.
 *
 * Terminar en `C`/`D` no alcanza (`C` es Citigroup, `ELPC` Copel, `BA.C` Bank of America), ni que
 * exista el símbolo sin la última letra (`BAC` es Boeing en CCL, no una variante de `BA.C`). Con ese
 * sufijo, una fila es variante si:
 * - vale menos de 100 (o 0, sin operaciones): en pesos, el CEDEAR más barato con operaciones vale
 *   354 (panel de oct 2026). Cubre las que no tienen base con su nombre (`GOGLC` de `GOOGL`,
 *   `AKOBD` de `AKO.B`) y las que están junto a otra variante (`BBDCD` y `BBDC`); o
 * - existe su base y la base vale más de 100 veces lo que ella: la base en pesos y la fila en
 *   dólares. Cubre las variantes de más de US$ 100 (`MUD`, `HWMC`).
 */
export const isUsdVariant = (row: PanelRow, bySymbol: ReadonlyMap<string, PanelRow>): boolean => {
  const baseSymbol = variantBase(row.symbol)
  if (!baseSymbol) return false
  if (row.c < MAX_USD_VARIANT_PRICE) return true
  const base = bySymbol.get(baseSymbol)
  return base !== undefined && base.c / row.c > MIN_ARS_TO_USD_RATIO
}

/** Las filas que son CEDEARs en ARS (sin las variantes en USD CCL / MEP) */
export const baseRows = <T extends PanelRow>(rows: readonly T[]): T[] => {
  const bySymbol = new Map(rows.map((row) => [row.symbol, row]))
  return rows.filter((row) => !isUsdVariant(row, bySymbol))
}

/**
 * Nombre del subyacente de los CEDEARs más operados. El panel solo trae tickers: el resto se
 * muestra con el ticker solo. Agregar acá cuando haga falta.
 */
const NAMES: Record<string, string> = {
  AAL: 'American Airlines',
  AAPL: 'Apple',
  ABNB: 'Airbnb',
  ADBE: 'Adobe',
  ALAB: 'Astera Labs',
  AMAT: 'Applied Materials',
  AMD: 'AMD',
  AMZN: 'Amazon',
  ARKK: 'ARK Innovation ETF',
  AVGO: 'Broadcom',
  B: 'Barrick Mining',
  BA: 'Boeing',
  'BA.C': 'Bank of America',
  BABA: 'Alibaba',
  BBD: 'Banco Bradesco',
  BIDU: 'Baidu',
  BRKB: 'Berkshire Hathaway',
  C: 'Citigroup',
  CEG: 'Constellation Energy',
  COIN: 'Coinbase',
  COST: 'Costco',
  CRM: 'Salesforce',
  CVX: 'Chevron',
  DIA: 'SPDR Dow Jones ETF',
  EEM: 'iShares MSCI Emerging Markets ETF',
  EWZ: 'iShares MSCI Brazil ETF',
  GLD: 'SPDR Gold Shares',
  GLOB: 'Globant',
  GOOGL: 'Alphabet (Google)',
  HD: 'Home Depot',
  IBIT: 'iShares Bitcoin Trust',
  IBM: 'IBM',
  INTC: 'Intel',
  IREN: 'IREN',
  JNJ: 'Johnson & Johnson',
  JPM: 'JPMorgan Chase',
  KO: 'Coca-Cola',
  MA: 'Mastercard',
  MCD: "McDonald's",
  MELI: 'Mercado Libre',
  META: 'Meta',
  MRNA: 'Moderna',
  MRVL: 'Marvell',
  MSFT: 'Microsoft',
  MSTR: 'Strategy (MicroStrategy)',
  MU: 'Micron',
  NBIS: 'Nebius',
  NFLX: 'Netflix',
  NKE: 'Nike',
  NU: 'Nu Holdings',
  NVDA: 'Nvidia',
  ORCL: 'Oracle',
  PBR: 'Petrobras',
  PEP: 'PepsiCo',
  PFE: 'Pfizer',
  PG: 'Procter & Gamble',
  PYPL: 'PayPal',
  QQQ: 'Invesco QQQ (Nasdaq 100)',
  RGTI: 'Rigetti Computing',
  SATL: 'Satellogic',
  SHOP: 'Shopify',
  SNDK: 'SanDisk',
  SPOT: 'Spotify',
  SPY: 'SPDR S&P 500 ETF',
  STNE: 'StoneCo',
  T: 'AT&T',
  TSLA: 'Tesla',
  TSM: 'TSMC',
  UBER: 'Uber',
  V: 'Visa',
  VALE: 'Vale',
  VIST: 'Vista Energy',
  VST: 'Vistra',
  WDC: 'Western Digital',
  WMT: 'Walmart',
  XLE: 'Energy Select Sector SPDR',
  XLF: 'Financial Select Sector SPDR',
  XLU: 'Utilities Select Sector SPDR',
  XOM: 'ExxonMobil',
}

export const cedearName = (ticker: string): string | null => NAMES[ticker] ?? null
