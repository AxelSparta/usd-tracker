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