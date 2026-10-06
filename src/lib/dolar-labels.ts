import { DolarOption } from '@/types/dolar.types'

/**
 * Nombre corto de cada tipo de dólar para textos de la UI y mensajes ("Compra de USD Blue").
 * No depende de DolarAPI (que trae el nombre largo y puede no haber cargado).
 */
export const DOLAR_LABELS: Record<DolarOption, string> = {
  [DolarOption.Oficial]: 'Oficial',
  [DolarOption.Blue]: 'Blue',
  [DolarOption.Bolsa]: 'MEP',
  [DolarOption.ContadoConLiqui]: 'CCL',
  [DolarOption.Tarjeta]: 'Tarjeta',
  [DolarOption.Mayorista]: 'Mayorista',
  [DolarOption.Cripto]: 'Cripto (USDT)',
}
