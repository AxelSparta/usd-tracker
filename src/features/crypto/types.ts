import type { TransactionType } from '@/types/transaction.types'

/** Moneda de CoinGecko (lo que se guarda para mostrarla sin volver a pedirla). */
export type Coin = {
  /** id de CoinGecko, ej. `bitcoin` */
  id: string
  /** Símbolo en mayúsculas, ej. `BTC` */
  symbol: string
  name: string
  image: string | null
}

export type CoinPrice = {
  usd: number
  /** Variación % en 24 h; `null` si CoinGecko no la informa */
  change24h: number | null
  /** Epoch en ms */
  updatedAt: number | null
}

export type CoinPriceMap = Record<string, CoinPrice>

/** Comisión en USD o en unidades de la propia moneda */
export type FeeCurrency = 'USD' | 'COIN'

export type CryptoFee = {
  amount: number
  currency: FeeCurrency
}

/** Operación cripto: todo expresado en USD. */
export type CryptoTransaction = {
  id: string
  coinId: string
  type: TransactionType
  /** Unidades de la moneda */
  quantity: number
  /** Precio unitario en USD al momento de la operación */
  priceUsd: number
  /** `Date` al crearla; string ISO tras rehidratar desde `localStorage` */
  date: Date | string
  /** Opcional: operaciones sin comisión (y todas las anteriores a la v2) no la tienen */
  fee?: CryptoFee
  /** Comparte el id con la otra pata de un intercambio cripto ↔ cripto */
  swapId?: string
  /** Comparte el id con la pata del módulo dólar (USDT) de un intercambio USDT ↔ cripto */
  usdtSwapId?: string
}

export type CryptoPosition = {
  coin: Coin
  quantity: number
  investedUsd: number
  averageCostUsd: number
  realizedPnlUsd: number
  /** `null` mientras no haya precio de mercado */
  priceUsd: number | null
  change24h: number | null
  marketValueUsd: number | null
  unrealizedPnlUsd: number | null
  /** PnL no realizado sobre el costo de la posición abierta, en % */
  unrealizedPnlPct: number | null
}

export type CryptoPortfolioSummary = {
  investedUsd: number
  /** Suma solo las posiciones con precio conocido */
  marketValueUsd: number
  unrealizedPnlUsd: number
  realizedPnlUsd: number
  /** true si alguna posición abierta todavía no tiene precio */
  hasMissingPrices: boolean
}
