/** `base × 2^(intento − 1)`, con tope en `max`. `attempt` arranca en 1. */
export const exponentialBackoff = (base: number, attempt: number, max: number): number =>
  Math.min(base * 2 ** Math.max(0, attempt - 1), max)
