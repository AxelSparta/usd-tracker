export enum DolarOption {
  Oficial = 'oficial',
  Blue = 'blue',
  Bolsa = 'bolsa',
  ContadoConLiqui = 'contadoconliqui',
  Tarjeta = 'tarjeta',
  Mayorista = 'mayorista',
  Cripto = 'cripto'
}

export type DolarData = {
  compra: number
  venta: number
  casa: string
  nombre: string
  moneda: string
  fechaActualizacion: string
}
