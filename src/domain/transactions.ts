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

/** Las patas de una conversión pesos ↔ dólar solo se borran completas (`features/pesos`) */
export const CONVERSION_LEG_UPDATE =
  'Las conversiones de pesos no se editan: borrala y cargala de nuevo.'
export const CONVERSION_LEG_REMOVE = 'Es una conversión de pesos: borrala completa.'

/** Enlace de una operación del Dólar con otro módulo (D8): un id concreto por tipo de enlace */
export type DolarLink =
  | { kind: 'usdtSwap'; id: string }
  | { kind: 'conversion'; id: string }

/** De qué operación enlazada es pata, o `null` si es una operación propia del módulo */
export const linkOf = (tx: Pick<Transaction, 'usdtSwapId' | 'conversionId'>): DolarLink | null =>
  tx.usdtSwapId
    ? { kind: 'usdtSwap', id: tx.usdtSwapId }
    : tx.conversionId
      ? { kind: 'conversion', id: tx.conversionId }
      : null

/** Mensaje al editar o borrar una pata desde el módulo Dólar */
const legMessage = (link: DolarLink, action: 'update' | 'remove') =>
  link.kind === 'usdtSwap'
    ? action === 'update' ? USDT_SWAP_LEG_UPDATE : USDT_SWAP_LEG_REMOVE
    : action === 'update' ? CONVERSION_LEG_UPDATE : CONVERSION_LEG_REMOVE

/**
 * Como mucho un enlace por operación; un resultado de trade en USDT vive en el dólar cripto
 * y no es pata de nada.
 */
export const assertDolarShape = (tx: Omit<Transaction, 'id'>) => {
  if (tx.usdtSwapId && tx.conversionId) {
    throw new Error('Una operación no puede ser parte de un intercambio y de una conversión.')
  }
  if (tx.kind !== TRADE_RESULT) return
  if (tx.dolarOption !== DolarOption.Cripto) {
    throw new Error('Los resultados de trades en USDT van en el dólar cripto.')
  }
  if (tx.usdtSwapId) throw new Error('Un resultado de trade no puede ser parte de un intercambio.')
  if (tx.conversionId) throw new Error('Un resultado de trade no puede ser parte de una conversión.')
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
  const link = linkOf(findTransaction(transactions, transactionId)!)
  if (link) throw new Error(legMessage(link, 'update'))
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
  const link = linkOf(findTransaction(transactions, transactionId)!)
  if (link) throw new Error(legMessage(link, 'remove'))

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
