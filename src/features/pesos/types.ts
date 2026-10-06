import type { TransactionType } from '@/types/transaction.types'

/**
 * Movimiento del saldo en pesos del portafolio (Fase 8). Pesos es un saldo, no un activo con
 * precio: sin PnL. `BUY` = ingreso, `SELL` = egreso (`sortTxs`: ingresos primero el mismo día).
 */
export type PesosMovement = {
  id: string
  type: TransactionType
  /** ARS, > 0 */
  amount: number
  /** `Date` al crearlo; string ISO tras rehidratar desde `localStorage` */
  date: Date | string
  /** Detalle libre, ej. "Sueldo", "Transferencia desde el banco" */
  note?: string
  /** Pata de una conversión pesos ↔ dólar (8.2): no se edita ni se borra sola */
  conversionId?: string
}

export type PesosState = {
  /** Lista plana ordenada con `sortTxs` */
  movements: PesosMovement[]
}
