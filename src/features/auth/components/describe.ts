import type { ImportResult } from '../api'
import type { LocalData } from '../local-import'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** "3 operaciones (2 del dólar y 1 de cripto)" */
export const describeLocalData = ({ dolar, crypto }: LocalData) => {
  const total = dolar.length + crypto.transactions.length
  const parts = [
    dolar.length > 0 && `${dolar.length} del dólar`,
    crypto.transactions.length > 0 && `${crypto.transactions.length} de cripto`,
  ].filter(Boolean)
  return `${plural(total, 'operación', 'operaciones')} (${parts.join(' y ')})`
}

export const describeImportResult = ({ dolar, crypto }: ImportResult) => {
  const created = dolar.created + crypto.created
  const skipped = dolar.skipped + crypto.skipped
  const base =
    created > 0
      ? `Subiste ${plural(created, 'operación', 'operaciones')} a tu cuenta.`
      : 'No había operaciones nuevas para subir.'
  return skipped > 0 ? `${base} ${plural(skipped, 'ya estaba', 'ya estaban')} en la nube.` : base
}
