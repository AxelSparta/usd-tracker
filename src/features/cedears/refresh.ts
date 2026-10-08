import { exponentialBackoff } from '@/lib/backoff'

export const PRICE_REFRESH_MS = 5 * 60 * 1000
export const MAX_PRICE_REFRESH_MS = 20 * 60 * 1000

/**
 * Espera hasta el próximo refresco de precios: 5 min si el último salió bien (data912 arma el
 * panel con demora) y, tras fallos consecutivos, 10 min → 20 min (tope).
 */
export const priceRefreshDelay = (consecutiveFailures: number): number =>
  exponentialBackoff(PRICE_REFRESH_MS, consecutiveFailures + 1, MAX_PRICE_REFRESH_MS)
