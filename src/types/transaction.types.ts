import { DolarOption } from './dolar.types'

export enum TransactionType {
  BUY = 'BUY',
  SELL = 'SELL',
}

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
}

export type TransactionsData = {
  totalUsd: number
  investedPesos: number      // Lo que realmente pusiste de tu bolsillo
  marketValuePesos: number   // El valor actual según el dólar hoy
  averageCost: number
  realizedProfit: number
  unrealizedProfit: number
}

export type TransactionsDataMap = Partial<Record<DolarOption, TransactionsData>>
