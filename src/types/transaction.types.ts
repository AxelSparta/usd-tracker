import { DolarOption } from './dolar.types'

export enum TransactionType {
  BUY = 'BUY',
  SELL = 'SELL',
}

/**
 * Variante de operación (sin `kind` = compra/venta normal). `TRADE_RESULT`: resultado de un
 * trade acreditado en la moneda (futuros, margin, bots), sin compra ni venta de por medio:
 * `BUY` = ganancia (entran unidades), `SELL` = pérdida (salen unidades). Fase 7b.
 */
export const TRADE_RESULT = 'TRADE_RESULT' as const
export type OperationKind = typeof TRADE_RESULT

/** Modelo de dominio (independiente del formulario). */
export type Transaction = {
  id: string
  type: TransactionType
  pesosAmount: number
  dollarsAmount: number
  /** `Date` al crearla; string ISO tras rehidratar desde `localStorage` */
  date: Date | string
  dolarOption: DolarOption
  /**
   * Enlaza esta operación (grupo `cripto` = saldo de USDT) con la pata del módulo cripto
   * de un intercambio USDT ↔ cripto (Fase 7a). No se edita ni se borra sola.
   */
  usdtSwapId?: string
  /**
   * Enlaza esta operación con el movimiento del módulo Pesos de una conversión pesos ↔ dólar
   * (Fase 8.2). No se edita ni se borra sola. Como mucho un enlace por operación (`linkOf`).
   */
  conversionId?: string
  /**
   * Pata de una operación de CEDEAR pagada o cobrada en dólares CCL (Fase 9): guarda el id de
   * la operación (solo en el grupo `contadoconliqui`). Se edita y se borra desde CEDEARs.
   */
  cedearId?: string
  /** Resultado de trade en USDT (solo en el grupo `cripto`) */
  kind?: OperationKind
  /** Detalle libre, ej. "BTCUSDT long x10" */
  note?: string
}

export type TransactionsData = {
  totalUsd: number
  investedPesos: number      // Lo que realmente pusiste de tu bolsillo
  marketValuePesos: number   // El valor actual según el dólar hoy
  averageCost: number
  realizedProfit: number
  /** Parte del PnL realizado que viene de resultados de trades (ARS) */
  tradeProfit: number
  unrealizedProfit: number
}

export type TransactionsDataMap = Partial<Record<DolarOption, TransactionsData>>
