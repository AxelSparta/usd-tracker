import type {
  CryptoTransaction as CryptoTransactionRow,
  DolarTransaction as DolarTransactionRow,
  PesosMovement as PesosMovementRow,
} from '@/generated/prisma/client'
import type { Coin, CryptoTransaction } from '@/features/crypto/types'
import type { PesosMovement } from '@/features/pesos/types'
import type { DolarOption } from '@/types/dolar.types'
import type { Transaction, TransactionType } from '@/types/transaction.types'

/**
 * Único lugar donde se convierte entre filas de Prisma y modelos de dominio.
 * Los montos son `Decimal` en la base y `number` en la app: `toNumber()` al leer;
 * al escribir, Prisma acepta `number` y lo guarda tal cual (numeric sin redondeo).
 */

export const toDolarTransaction = (row: DolarTransactionRow): Transaction => ({
  id: row.id,
  type: row.type as TransactionType,
  pesosAmount: row.pesosAmount.toNumber(),
  dollarsAmount: row.dollarsAmount.toNumber(),
  date: row.date,
  dolarOption: row.dolarOption as DolarOption,
  ...(row.usdtSwapId !== null && { usdtSwapId: row.usdtSwapId }),
  ...(row.kind !== null && { kind: row.kind }),
  ...(row.note !== null && { note: row.note }),
})

export const toDolarTransactionData = (tx: Omit<Transaction, 'id'>) => ({
  type: tx.type,
  pesosAmount: tx.pesosAmount,
  dollarsAmount: tx.dollarsAmount,
  date: new Date(tx.date),
  dolarOption: tx.dolarOption,
  usdtSwapId: tx.usdtSwapId ?? null,
  kind: tx.kind ?? null,
  note: tx.note ?? null,
})

export const toCryptoTransaction = (row: CryptoTransactionRow): CryptoTransaction => ({
  id: row.id,
  coinId: row.coinId,
  type: row.type as TransactionType,
  quantity: row.quantity.toNumber(),
  priceUsd: row.priceUsd.toNumber(),
  date: row.date,
  ...(row.feeAmount !== null &&
    row.feeCurrency !== null && {
      fee: { amount: row.feeAmount.toNumber(), currency: row.feeCurrency },
    }),
  ...(row.swapId !== null && { swapId: row.swapId }),
  ...(row.usdtSwapId !== null && { usdtSwapId: row.usdtSwapId }),
  ...(row.kind !== null && { kind: row.kind }),
  ...(row.note !== null && { note: row.note }),
})

export const toCoin = (row: CryptoTransactionRow): Coin => ({
  id: row.coinId,
  symbol: row.symbol,
  name: row.name,
  image: row.image,
})

/** Operación + metadatos de su moneda (se guardan en la misma fila) */
export const toCryptoTransactionData = (
  tx: Omit<CryptoTransaction, 'id'>,
  coin: Coin,
) => ({
  coinId: tx.coinId,
  symbol: coin.symbol,
  name: coin.name,
  image: coin.image,
  type: tx.type,
  quantity: tx.quantity,
  priceUsd: tx.priceUsd,
  date: new Date(tx.date),
  feeAmount: tx.fee?.amount ?? null,
  feeCurrency: tx.fee?.currency ?? null,
  swapId: tx.swapId ?? null,
  usdtSwapId: tx.usdtSwapId ?? null,
  kind: tx.kind ?? null,
  note: tx.note ?? null,
})

export const toPesosMovement = (row: PesosMovementRow): PesosMovement => ({
  id: row.id,
  type: row.type as TransactionType,
  amount: row.amount.toNumber(),
  date: row.date,
  ...(row.note !== null && { note: row.note }),
  ...(row.conversionId !== null && { conversionId: row.conversionId }),
})

export const toPesosMovementData = (movement: Omit<PesosMovement, 'id'>) => ({
  type: movement.type,
  amount: movement.amount,
  date: new Date(movement.date),
  note: movement.note ?? null,
  conversionId: movement.conversionId ?? null,
})
