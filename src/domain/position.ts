import { TransactionType } from '@/types/transaction.types'

/**
 * Operación mínima que entiende el motor: `quantity` unidades del activo
 * (USD, BTC…) a cambio de `quoteAmount` en la moneda de cotización (ARS, USD…).
 */
export type PositionLot = {
  type: TransactionType
  quantity: number
  quoteAmount: number
}

/** Resultado sin redondear; cada módulo redondea según su unidad. */
export type Position = {
  quantity: number
  invested: number
  averageCost: number
  realizedProfit: number
}

/**
 * Costo promedio ponderado sobre lotes ya ordenados con `sortTxs`.
 * Cada venta realiza `(precio de venta − costo promedio) × cantidad` y reduce la posición.
 * `dust`: por debajo de esa cantidad la posición se considera cerrada (ruido de coma
 * flotante); depende de la unidad (0,0001 USD no importa, 0,0001 BTC sí).
 */
export const computePosition = (
  lots: PositionLot[],
  { dust = 1e-9 }: { dust?: number } = {},
): Position => {
  let quantity = 0
  let invested = 0
  let averageCost = 0
  let realizedProfit = 0

  for (const lot of lots) {
    const lotQuantity = Number(lot.quantity) || 0
    const quoteAmount = Number(lot.quoteAmount) || 0

    if (lot.type === TransactionType.BUY) {
      invested += quoteAmount
      quantity += lotQuantity
      averageCost = quantity > 0 ? invested / quantity : 0
    }

    if (lot.type === TransactionType.SELL) {
      const unitPrice = lotQuantity > 0 ? quoteAmount / lotQuantity : 0
      realizedProfit += (unitPrice - averageCost) * lotQuantity
      quantity -= lotQuantity
      if (quantity < dust) quantity = 0
      invested = quantity * averageCost
    }
  }

  return { quantity, invested, averageCost, realizedProfit }
}
