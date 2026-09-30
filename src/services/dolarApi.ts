import { DolarData } from '@/types/dolar.types'

const BASE_DOLAR_URL = 'https://dolarapi.com/v1/dolares'

export const getAllDolars = async (): Promise<DolarData[]> => {
  const response = await fetch(BASE_DOLAR_URL)
  if (!response.ok) {
    throw new Error(`DolarAPI respondió ${response.status}`)
  }
  return await response.json()
}
