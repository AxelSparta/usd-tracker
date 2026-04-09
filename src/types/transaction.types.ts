import { TransactionFormValues } from '@/validations/transaction'
import { DolarOption } from './dolar.types'

export enum TransactionType {
  BUY = 'BUY',
  SELL = 'SELL',
}

export type Transaction = TransactionFormValues & {
  id: string
  usdPrice: number
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
