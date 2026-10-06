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

/**
 * Movimiento de Pesos: `BUY` = ingreso, `SELL` = egreso. Si es la pata de una conversión, se
 * describe desde Pesos con el tipo de dólar (`dolar`, ej. "Blue"): salen pesos = compra de USD.
 */
export const pesosMovementLabel = ({ type }: { type: TransactionType }, dolar?: string) => {
  const entering = type === TransactionType.BUY
  if (dolar) {
    return { label: entering ? `Venta de USD ${dolar}` : `Compra de USD ${dolar}`, positive: entering }
  }
  return { label: entering ? 'Ingreso' : 'Egreso', positive: entering }
}
