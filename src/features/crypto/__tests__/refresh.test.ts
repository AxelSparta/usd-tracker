import { describe, expect, it } from 'vitest'
import {
  MAX_PRICE_REFRESH_MS,
  PRICE_REFRESH_MS,
  priceRefreshDelay,
} from '@/features/crypto/refresh'

describe('priceRefreshDelay', () => {
  it('refresca cada minuto mientras no hay fallos', () => {
    expect(priceRefreshDelay(0)).toBe(PRICE_REFRESH_MS)
  })

  it('duplica la espera con cada fallo consecutivo', () => {
    expect(priceRefreshDelay(1)).toBe(2 * PRICE_REFRESH_MS)
    expect(priceRefreshDelay(2)).toBe(4 * PRICE_REFRESH_MS)
    expect(priceRefreshDelay(3)).toBe(8 * PRICE_REFRESH_MS)
  })

  it('no supera el tope de 10 minutos', () => {
    expect(priceRefreshDelay(4)).toBe(MAX_PRICE_REFRESH_MS)
    expect(priceRefreshDelay(50)).toBe(MAX_PRICE_REFRESH_MS)
  })
})
