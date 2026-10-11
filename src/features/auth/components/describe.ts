import type { ImportResult } from '../api'
import type { LocalData } from '../local-import'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

const list = new Intl.ListFormat('es', { type: 'conjunction' })

/** "4 operaciones (2 del dólar, 1 de cripto y 1 de pesos)" */
export const describeLocalData = ({ dolar, crypto, pesos, cedears }: LocalData) => {
  const total = dolar.length + crypto.transactions.length + pesos.length + cedears.length
  const parts = [
    dolar.length > 0 && `${dolar.length} del dólar`,
    crypto.transactions.length > 0 && `${crypto.transactions.length} de cripto`,
    pesos.length > 0 && `${pesos.length} de pesos`,
    cedears.length > 0 && `${cedears.length} de CEDEARs`,
  ].filter((part): part is string => !!part)
  return `${plural(total, 'operación', 'operaciones')} (${list.format(parts)})`
}

export const describeImportResult = ({ dolar, crypto, pesos, cedears }: ImportResult) => {
  const modules = [dolar, crypto, pesos, cedears]
  const created = modules.reduce((sum, m) => sum + m.created, 0)
  const skipped = modules.reduce((sum, m) => sum + m.skipped, 0)
  const base =
    created > 0
      ? `Subiste ${plural(created, 'operación', 'operaciones')} a tu cuenta.`
      : 'No había operaciones nuevas para subir.'
  return skipped > 0 ? `${base} ${plural(skipped, 'ya estaba', 'ya estaban')} en la nube.` : base
}
