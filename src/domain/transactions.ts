import { DolarOption } from '@/types/dolar.types'
import { TRADE_RESULT, type Transaction } from '@/types/transaction.types'
import { sortTxs, validateTimeline } from './timeline'

/**
 * Operaciones del módulo dólar sobre el estado agrupado por tipo de dólar.
 * Puras: devuelven el estado nuevo o lanzan `Error` (mensaje en español) si la
 * línea temporal queda inconsistente. Las usan el store (cliente) y la API (server),
 * así los dos validan igual.
 */

export type GroupedTransactions = Partial<Record<DolarOption, Transaction[]>>

/** Las patas de un intercambio USDT ↔ cripto solo se borran completas (`features/usdt-swaps`) */
export const USDT_SWAP_LEG_UPDATE =
  'Los intercambios con USDT no se editan: borralo y cargalo de nuevo.'
export const USDT_SWAP_LEG_REMOVE = 'Es un intercambio con USDT: borralo completo.'

/** Un resultado de trade en USDT vive en el dólar cripto y no es parte de un intercambio */
export const assertDolarShape = (tx: Omit<Transaction, 'id'>) => {
  if (tx.kind !== TRADE_RESULT) return
  if (tx.dolarOption !== DolarOption.Cripto) {
    throw new Error('Los resultados de trades en USDT van en el dólar cripto.')
  }
  if (tx.usdtSwapId) throw new Error('Un resultado de trade no puede ser parte de un intercambio.')
}

const findTransaction = (transactions: GroupedTransactions, transactionId: string) =>
  Object.values(transactions)
    .flatMap((group) => group ?? [])
    .find((tx) => tx.id === transactionId)

/** Agrupa por tipo de dólar, cada grupo ordenado con `sortTxs` */
export const groupTransactions = (txs: Transaction[]): GroupedTransactions => {
  const groups: GroupedTransactions = {}
  for (const tx of txs) {
    ;(groups[tx.dolarOption] ??= []).push(tx)
  }
  for (const option of Object.keys(groups) as DolarOption[]) {
    groups[option] = sortTxs(groups[option]!)
  }
  return groups
}

export const findGroup = (
  transactions: GroupedTransactions,
  transactionId: string,
): DolarOption | null => {
  for (const option in transactions) {
    if (transactions[option as DolarOption]?.some((tx) => tx.id === transactionId)) {
      return option as DolarOption
    }
  }
  return null
}

export const applyAddTransaction = (
  transactions: GroupedTransactions,
  tx: Transaction,
): GroupedTransactions => {
  assertDolarShape(tx)
  const group = sortTxs([...(transactions[tx.dolarOption] || []), tx])
  validateTimeline(group)
  return { ...transactions, [tx.dolarOption]: group }
}

/** `null` si la operación no existe */
export const applyUpdateTransaction = (
  transactions: GroupedTransactions,
  transactionId: string,
  tx: Omit<Transaction, 'id'>,
): GroupedTransactions | null => {
  const previousOption = findGroup(transactions, transactionId)
  if (!previousOption) return null
  if (findTransaction(transactions, transactionId)?.usdtSwapId) {
    throw new Error(USDT_SWAP_LEG_UPDATE)
  }
  assertDolarShape(tx)

  const updated: GroupedTransactions = {
    ...transactions,
    [previousOption]: (transactions[previousOption] || []).filter(
      (t) => t.id !== transactionId,
    ),
  }
  updated[tx.dolarOption] = sortTxs([
    ...(updated[tx.dolarOption] || []),
    { id: transactionId, ...tx },
  ])

  // Si cambió el tipo de dólar, el grupo de origen también pierde saldo
  validateTimeline(updated[tx.dolarOption]!)
  if (previousOption !== tx.dolarOption) {
    validateTimeline(updated[previousOption]!)
  }
  return updated
}

/** `null` si la operación no existe */
export const applyRemoveTransaction = (
  transactions: GroupedTransactions,
  transactionId: string,
): GroupedTransactions | null => {
  const option = findGroup(transactions, transactionId)
  if (!option) return null
  if (findTransaction(transactions, transactionId)?.usdtSwapId) {
    throw new Error(USDT_SWAP_LEG_REMOVE)
  }

  const group = sortTxs(
    (transactions[option] || []).filter((tx) => tx.id !== transactionId),
  )
  validateTimeline(group)
  return { ...transactions, [option]: group }
}

/** Valida la línea temporal de todos los grupos (lanza con el mensaje del primero inválido) */
export const validateAllGroups = (transactions: GroupedTransactions) => {
  for (const group of Object.values(transactions)) {
    if (group) validateTimeline(group)
  }
}
