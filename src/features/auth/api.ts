import { requestJson } from '@/lib/http'
import type { LocalData } from './local-import'

export type ImportResult = {
  dolar: { created: number; skipped: number }
  crypto: { created: number; skipped: number }
  pesos: { created: number; skipped: number }
}

/** Sube operaciones locales; las que ya están en la nube se saltean (la nube manda) */
export const importLocalData = (data: LocalData) =>
  requestJson<ImportResult>('/api/sync/import', { method: 'POST', body: data })
