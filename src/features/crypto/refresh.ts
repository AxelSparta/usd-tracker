import { exponentialBackoff } from '@/lib/backoff'

export const PRICE_REFRESH_MS = 60 * 1000
export const MAX_PRICE_REFRESH_MS = 10 * 60 * 1000

/**
 * Espera hasta el próximo refresco de precios: 60 s si el último salió bien y,
 * tras fallos consecutivos (típicamente 429 de CoinGecko), backoff exponencial
 * 2 min → 4 min → 8 min, con tope en 10 min.
 */
export const priceRefreshDelay = (consecutiveFailures: number): number =>
  exponentialBackoff(PRICE_REFRESH_MS, consecutiveFailures + 1, MAX_PRICE_REFRESH_MS)
