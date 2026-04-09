/**
 * Formato AR: miles con punto, decimales con coma.
 */

export function parseLocaleAmount(s: string): number {
  const t = s.trim()
  if (!t || t === ',') return Number.NaN
  const normalized = t.replace(/\./g, '').replace(',', '.')
  const n = Number.parseFloat(normalized)
  return n
}

/**
 * Formatea el texto mientras el usuario escribe (solo dígitos, una coma decimal y puntos de miles).
 */
export function formatAmountArInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.,]/g, '')
  const commaIdx = cleaned.indexOf(',')

  let intDigits: string
  let fracDigits: string
  let hasComma: boolean

  if (commaIdx === -1) {
    intDigits = cleaned.replace(/\./g, '')
    fracDigits = ''
    hasComma = false
  } else {
    hasComma = true
    intDigits = cleaned
      .slice(0, commaIdx)
      .replace(/\./g, '')
      .replace(/,/g, '')
    fracDigits = cleaned.slice(commaIdx + 1).replace(/[^\d]/g, '')
  }

  if (intDigits.length > 1) {
    intDigits = intDigits.replace(/^0+/, '') || '0'
  }

  if (!intDigits && !fracDigits) {
    return hasComma ? ',' : ''
  }

  const intDisplay = intDigits
    ? intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    : '0'

  if (hasComma) {
    return `${intDisplay},${fracDigits}`
  }

  return intDisplay
}

/**
 * Formatea un número para mostrar en la UI con formato AR (1.234,56)
 */
export function formatCurrency(amount: number | null | undefined, decimals: number = 2): string {
  const value = amount ?? 0
  if (isNaN(value)) return '0,00'

  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}
