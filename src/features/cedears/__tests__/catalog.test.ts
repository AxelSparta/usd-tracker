import { describe, expect, it } from 'vitest'
import { baseRows, CEDEAR_TICKER, cedearName } from '../catalog'
// Filas reales de data912 `/live/arg_cedears` (oct 2026) con los casos difíciles
import panel from './panel-2026-10.json'

describe('baseRows (variantes en USD del panel de data912)', () => {
  const bases = baseRows(panel).map((row) => row.symbol)

  it('deja los CEDEARs en ARS, incluidos los que terminan en C/D', () => {
    expect(bases.sort()).toEqual(
      ['AAPL', 'AKO.B', 'B', 'BA', 'BA.C', 'BB', 'BBD', 'BMY', 'C', 'ELPC', 'GOOGL', 'KO', 'MELI', 'MU', 'NVDA'].sort(),
    )
  })

  it('BAC es Boeing en CCL; Bank of America es BA.C y sus variantes, BA.CC / BA.CD', () => {
    expect(bases).toContain('BA.C')
    expect(bases).not.toContain('BAC')
    expect(bases).not.toContain('BA.CC')
    expect(bases).not.toContain('BA.CD')
  })

  it('variantes sin base con su nombre, junto a otra variante o con precio 0', () => {
    for (const symbol of ['GOGLC', 'GOGLD', 'AKOBD', 'PETRC', 'BBDCD', 'BMYC']) {
      expect(bases).not.toContain(symbol)
    }
  })

  it('variantes de más de US$ 100 por la razón con su base', () => {
    expect(panel.find((row) => row.symbol === 'MUD')!.c).toBeGreaterThan(100)
    expect(bases).not.toContain('MUC')
    expect(bases).not.toContain('MUD')
  })
})

describe('CEDEAR_TICKER', () => {
  it('acepta tickers con un sufijo tras un punto y rechaza el resto', () => {
    for (const ticker of ['AAPL', 'BA.C', 'AKO.B', 'BBAS3', 'C']) expect(CEDEAR_TICKER.test(ticker)).toBe(true)
    for (const ticker of ['aapl', 'BA..C', 'BA.', '.C', 'AAPL/../X', '']) expect(CEDEAR_TICKER.test(ticker)).toBe(false)
  })

  it('todos los símbolos del panel real son válidos', () => {
    expect(panel.every((row) => CEDEAR_TICKER.test(row.symbol))).toBe(true)
  })
})

describe('cedearName', () => {
  it('nombre del subyacente si está en el catálogo', () => {
    expect(cedearName('AAPL')).toBe('Apple')
    expect(cedearName('BA.C')).toBe('Bank of America')
    expect(cedearName('ELPC')).toBeNull()
  })
})
