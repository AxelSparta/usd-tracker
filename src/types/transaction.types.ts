export enum TransactionType {
  BUY = 'BUY',
  SELL = 'SELL'
}

export type Transaction = {
  id: string
  pesosAmount: number
  dollarsAmount: number
  usdPrice: number
  type: TransactionType
  date: Date
}

export type TransactionsData = {
  totalUsd: number
  totalPesos: number
  averageCost: number
  realizedProfit: number
  unrealizedProfit: number
}