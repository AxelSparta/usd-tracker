import { DolarData } from '@/types/dolar.types'

const BASE_DOLAR_URL = 'https://dolarapi.com/v1/dolares'
const TIMEOUT_MS = 10_000

/** Error de DolarAPI: `offline` = no hubo respuesta (red caída o timeout) */
export class DolarApiError extends Error {
  constructor(
    message: string,
    readonly offline: boolean,
  ) {
    super(message)
  }
}

export const getAllDolars = async (): Promise<DolarData[]> => {
  let response: Response
  try {
    response = await fetch(BASE_DOLAR_URL, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch {
    throw new DolarApiError('Sin respuesta de DolarAPI', true)
  }
  if (!response.ok) {
    throw new DolarApiError(`DolarAPI respondió ${response.status}`, false)
  }
  return await response.json()
}
