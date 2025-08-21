export type TransactionType = 'BUY' | 'SELL'

export type Transaction = {
  id: string
  pesos: number
  usd: number
  usdPerPesos: number
  type: TransactionType
  date: string
}

export type TransactionsData = {
  totalPesos: number
  totalUsd: number
  gananciaPerdida: number
}
