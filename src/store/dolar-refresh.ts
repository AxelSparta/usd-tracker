import { exponentialBackoff } from '@/lib/backoff'

export const DOLAR_REFRESH_MS = 5 * 60 * 1000
const FIRST_RETRY_MS = 30 * 1000

/**
 * Espera hasta el próximo pedido de cotizaciones: cada 5 min si el último salió bien.
 * Tras un fallo (red caída, DolarAPI caída) reintenta antes, con backoff:
 * 30 s → 1 min → 2 min → 4 min, sin pasar de los 5 min normales.
 */
export const dolarRefreshDelay = (consecutiveFailures: number): number =>
  consecutiveFailures === 0
    ? DOLAR_REFRESH_MS
    : exponentialBackoff(FIRST_RETRY_MS, consecutiveFailures, DOLAR_REFRESH_MS)
