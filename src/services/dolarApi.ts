import { DolarData, DolarOption } from '@/types/dolar.types'

const BASE_DOLAR_URL = 'https://dolarapi.com/v1/dolares'

export const getDolar = async (option: DolarOption): Promise<DolarData> => {
  const response = await fetch(`${BASE_DOLAR_URL}/${option}`)
  const data = await response.json()
  return data
}
