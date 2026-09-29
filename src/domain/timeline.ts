import { TransactionType, type Transaction } from '@/types/transaction.types'

type TimelineTx = Pick<Transaction, 'type' | 'date' | 'dollarsAmount'>

/** Sort by date ascending; same-day ties: BUY before SELL */
export const sortTxs = <T extends TimelineTx>(txs: T[]): T[] =>
  [...txs].sort((a, b) => {
    const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime()
    if (dateDiff !== 0) return dateDiff
    if (a.type === b.type) return 0
    return a.type === TransactionType.BUY ? -1 : 1
  })

/** Lanza si en algún punto de la línea temporal (ya ordenada) el balance USD queda negativo */
export const validateTimeline = (txs: TimelineTx[]) => {
  let balance = 0

  for (const tx of txs) {
    if (tx.type === TransactionType.BUY) {
      balance += tx.dollarsAmount
    } else {
      balance -= tx.dollarsAmount
    }

    if (balance < 0) {
      throw new Error(`Balance negativo detectado en fecha ${tx.date}`)
    }
  }
}
