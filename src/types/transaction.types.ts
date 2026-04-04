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
  totalPesos: number
  averageCost: number
  realizedProfit: number
  unrealizedProfit: number
}

export type TransactionsDataMap = Partial<Record<DolarOption, TransactionsData>>
