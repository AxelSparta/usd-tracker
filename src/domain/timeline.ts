import { TransactionType, type Transaction } from '@/types/transaction.types'

type DatedTx = Pick<Transaction, 'type' | 'date'>
type TimelineTx = DatedTx & Pick<Transaction, 'dollarsAmount'>

/** Sort by date ascending; same-day ties: BUY before SELL */
export const sortTxs = <T extends DatedTx>(txs: T[]): T[] =>
  [...txs].sort((a, b) => {
    const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime()
    if (dateDiff !== 0) return dateDiff
    if (a.type === b.type) return 0
    return a.type === TransactionType.BUY ? -1 : 1
  })

/**
 * Primera operación (de una línea temporal ya ordenada) que deja el balance negativo,
 * o `null` si la línea es consistente.
 */
export const findNegativeBalance = <T extends DatedTx>(
  txs: T[],
  getQuantity: (tx: T) => number,
): T | null => {
  let balance = 0
  // Tolerancia para no rechazar "vender todo" por ruido de coma flotante (0,1 + 0,2 − 0,3)
  const epsilon = 1e-9

  for (const tx of txs) {
    balance += tx.type === TransactionType.BUY ? getQuantity(tx) : -getQuantity(tx)
    if (balance < -epsilon) return tx
  }
  return null
}

/** Lanza si en algún punto de la línea temporal (ya ordenada) el balance USD queda negativo */
export const validateTimeline = (txs: TimelineTx[]) => {
  const offending = findNegativeBalance(txs, (tx) => tx.dollarsAmount)
  if (offending) {
    throw new Error(`Balance negativo detectado en fecha ${offending.date}`)
  }
}
