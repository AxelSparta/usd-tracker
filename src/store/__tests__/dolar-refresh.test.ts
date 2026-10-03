import { describe, expect, it } from 'vitest'
import { DOLAR_REFRESH_MS, dolarRefreshDelay } from '@/store/dolar-refresh'

describe('dolarRefreshDelay', () => {
  it('cada 5 minutos mientras no hay fallos', () => {
    expect(dolarRefreshDelay(0)).toBe(DOLAR_REFRESH_MS)
  })

  it('tras un fallo reintenta antes, duplicando la espera, con tope en 5 min', () => {
    expect([1, 2, 3, 4, 5, 20].map(dolarRefreshDelay)).toEqual([
      30_000, 60_000, 120_000, 240_000, DOLAR_REFRESH_MS, DOLAR_REFRESH_MS,
    ])
  })
})
