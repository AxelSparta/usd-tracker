const BASE_DOLAR_URL = 'https://dolarapi.com/v1/dolares'

export type DolarOption =
  | 'oficial'
  | 'blue'
  | 'bolsa'
  | 'contadoconliqui'
  | 'tarjeta'
  | 'mayorista'
  | 'cripto'

export type DolarData = {
  compra: number
  venta: number
  casa: string
  nombre: string
  moneda: string
  fechaActualizacion: string
}

export const getDolar = async (option: DolarOption): Promise<DolarData> => {
  const response = await fetch(`${BASE_DOLAR_URL}/${option}`)
  const data = await response.json()
  return data
}
