import { TRADE_RESULT, TransactionType, type OperationKind } from '@/types/transaction.types'

/**
 * Texto y tono de una operación en los historiales. Un único lugar: un resultado de trade usa
 * `BUY`/`SELL` para mover unidades, pero no es una compra ni una venta.
 */
export const operationLabel = ({ type, kind }: { type: TransactionType; kind?: OperationKind }) => {
  const entering = type === TransactionType.BUY
  if (kind === TRADE_RESULT) {
    return { label: entering ? 'Ganancia de trade' : 'Pérdida de trade', positive: entering }
  }
  return { label: entering ? 'Compra' : 'Venta', positive: entering }
}

/** Movimiento de Pesos: `BUY` = ingreso, `SELL` = egreso */
export const pesosMovementLabel = ({ type }: { type: TransactionType }) => {
  const entering = type === TransactionType.BUY
  return { label: entering ? 'Ingreso' : 'Egreso', positive: entering }
}
