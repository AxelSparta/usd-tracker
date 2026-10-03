import { format } from 'date-fns'
import { findNegativeBalance, sortTxs } from '@/domain/timeline'
import type { GroupedTransactions } from '@/domain/transactions'
import { assertCoinTimeline, type CryptoPortfolioState } from '@/features/crypto/operations'
import type { Coin, CryptoTransaction } from '@/features/crypto/types'
import { DolarOption } from '@/types/dolar.types'
import { TransactionType, type Transaction } from '@/types/transaction.types'

/**
 * Intercambios USDT ↔ cripto (Fase 7a). El grupo `cripto` del módulo Dólar **es** el saldo de
 * USDT, así que un intercambio son dos operaciones enlazadas por `usdtSwapId`: una del dólar
 * (grupo `cripto`) y otra del módulo cripto. Puras: las usan los stores (cliente) y la API
 * (server), así los dos validan igual. Lanzan `Error` en español si algún saldo no alcanza.
 */

/** id de CoinGecko de Tether: no se intercambia contra sí mismo (los USDT son el dólar cripto) */
export const TETHER_COIN_ID = 'tether'

export type UsdtSwapDirection = 'USDT_TO_COIN' | 'COIN_TO_USDT'

/** Comisión en USDT (mueve el saldo del dólar cripto) o en la moneda (mueve sus unidades) */
export type UsdtSwapFee = { amount: number; currency: 'USDT' | 'COIN' }

export type UsdtSwapInput = {
  direction: UsdtSwapDirection
  coin: Coin
  /** Unidades de la moneda que se compran o se venden (sin la comisión en la moneda) */
  quantity: number
  /** USDT del intercambio, sin la comisión */
  usdt: number
  fee?: UsdtSwapFee
  /** Cotización del dólar cripto en ARS (compra si se entregan USDT, venta si se reciben) */
  arsRate: number
  date: Date | string
}

export type UsdtSwapIds = { usdtSwapId: string; dolarId: string; cryptoId: string }

export type LinkedState = {
  dolar: GroupedTransactions
  crypto: CryptoPortfolioState
}

const formatDate = (date: Date | string) => format(new Date(date), 'dd/MM/yyyy')

/**
 * USDT que se mueven en el saldo del dólar cripto. Con comisión en USDT, entregar cuesta
 * `usdt + fee` y recibir deja `usdt − fee`: así el costo (o lo cobrado) de la pata cripto ya
 * la incluye y el saldo de USDT queda exacto.
 */
export const usdtMoved = ({ direction, usdt, fee }: Pick<UsdtSwapInput, 'direction' | 'usdt' | 'fee'>) => {
  const usdtFee = fee?.currency === 'USDT' ? fee.amount : 0
  return direction === 'USDT_TO_COIN' ? usdt + usdtFee : usdt - usdtFee
}

/** `[pata dólar, pata cripto]` según la dirección */
export const buildUsdtSwapLegs = (
  input: UsdtSwapInput,
  { usdtSwapId, dolarId, cryptoId }: UsdtSwapIds,
): [Transaction, CryptoTransaction] => {
  const { direction, coin, quantity, arsRate, date, fee } = input
  const usdt = usdtMoved(input)
  const toCoin = direction === 'USDT_TO_COIN'
  return [
    {
      id: dolarId,
      type: toCoin ? TransactionType.SELL : TransactionType.BUY,
      dollarsAmount: usdt,
      pesosAmount: usdt * arsRate,
      date,
      dolarOption: DolarOption.Cripto,
      usdtSwapId,
    },
    {
      id: cryptoId,
      coinId: coin.id,
      type: toCoin ? TransactionType.BUY : TransactionType.SELL,
      quantity,
      priceUsd: usdt / quantity,
      date,
      ...(fee?.currency === 'COIN' && { fee: { amount: fee.amount, currency: 'COIN' as const } }),
      usdtSwapId,
    },
  ]
}

const assertInput = (input: UsdtSwapInput) => {
  if (input.coin.id === TETHER_COIN_ID) {
    throw new Error('Los USDT ya son el dólar cripto: elegí otra moneda.')
  }
  if (!(input.quantity > 0) || !(input.usdt > 0)) {
    throw new Error('Las cantidades deben ser mayores a cero.')
  }
  if (!(input.arsRate > 0)) throw new Error('Ingresá la cotización del dólar cripto.')
  if (!(usdtMoved(input) > 0)) {
    throw new Error('La comisión no puede ser mayor o igual a los USDT que recibís.')
  }
  if (
    input.direction === 'USDT_TO_COIN' &&
    input.fee?.currency === 'COIN' &&
    input.fee.amount >= input.quantity
  ) {
    throw new Error('La comisión no puede superar la cantidad que recibís.')
  }
}

/** Lanza si los USDT del dólar cripto quedan negativos en algún momento */
const assertUsdtTimeline = (group: Transaction[], message: (date: string) => string) => {
  const offending = findNegativeBalance(sortTxs(group), (tx) => tx.dollarsAmount)
  if (offending) throw new Error(message(formatDate(offending.date)))
}

export const applyAddUsdtSwap = (
  { dolar, crypto }: LinkedState,
  input: UsdtSwapInput,
  ids: UsdtSwapIds,
): LinkedState => {
  assertInput(input)
  const [dolarLeg, cryptoLeg] = buildUsdtSwapLegs(input, ids)

  const usdtGroup = sortTxs([...(dolar[DolarOption.Cripto] ?? []), dolarLeg])
  assertUsdtTimeline(usdtGroup, (date) => `No tenés suficientes USDT el ${date}.`)

  assertCoinTimeline(
    [...crypto.transactions.filter((t) => t.coinId === input.coin.id), cryptoLeg],
    input.coin,
    (symbol, date) => `No tenés suficiente ${symbol} para intercambiar el ${date}.`,
  )

  return {
    dolar: { ...dolar, [DolarOption.Cripto]: usdtGroup },
    crypto: {
      transactions: [...crypto.transactions, cryptoLeg],
      coins: { ...crypto.coins, [input.coin.id]: input.coin },
    },
  }
}

/**
 * Quita las dos patas y revalida las dos líneas temporales: los USDT o la moneda recibidos
 * pueden haberse vendido después. `null` si el intercambio no existe.
 */
export const applyRemoveUsdtSwap = (
  { dolar, crypto }: LinkedState,
  usdtSwapId: string,
): { state: LinkedState; removedIds: string[] } | null => {
  const usdtGroup = dolar[DolarOption.Cripto] ?? []
  const dolarLegs = usdtGroup.filter((t) => t.usdtSwapId === usdtSwapId)
  const cryptoLegs = crypto.transactions.filter((t) => t.usdtSwapId === usdtSwapId)
  if (dolarLegs.length + cryptoLegs.length === 0) return null

  const remainingUsdt = usdtGroup.filter((t) => t.usdtSwapId !== usdtSwapId)
  assertUsdtTimeline(
    remainingUsdt,
    (date) => `No se puede eliminar: la venta de USDT del ${date} quedaría sin saldo.`,
  )
  const remainingCrypto = crypto.transactions.filter((t) => t.usdtSwapId !== usdtSwapId)
  for (const coinId of new Set(cryptoLegs.map((t) => t.coinId))) {
    assertCoinTimeline(
      remainingCrypto.filter((t) => t.coinId === coinId),
      crypto.coins[coinId],
      (symbol, date) =>
        `No se puede eliminar: la venta de ${symbol} del ${date} quedaría sin saldo.`,
    )
  }

  return {
    state: {
      dolar: { ...dolar, [DolarOption.Cripto]: remainingUsdt },
      crypto: { transactions: remainingCrypto, coins: crypto.coins },
    },
    removedIds: [...dolarLegs, ...cryptoLegs].map((t) => t.id),
  }
}

/**
 * Para la importación: cada `usdtSwapId` tiene exactamente una pata del dólar (grupo `cripto`)
 * y una del módulo cripto. Una pata suelta dejaría un saldo sin su contraparte.
 */
export const assertUsdtSwapsComplete = (dolar: Transaction[], crypto: CryptoTransaction[]) => {
  const legs = new Map<string, { dolar: number; crypto: number }>()
  const count = (id: string, side: 'dolar' | 'crypto') => {
    const entry = legs.get(id) ?? { dolar: 0, crypto: 0 }
    entry[side]++
    legs.set(id, entry)
  }
  for (const tx of dolar) {
    if (!tx.usdtSwapId) continue
    if (tx.dolarOption !== DolarOption.Cripto) {
      throw new Error('Un intercambio con USDT tiene que salir del dólar cripto.')
    }
    count(tx.usdtSwapId, 'dolar')
  }
  for (const tx of crypto) if (tx.usdtSwapId) count(tx.usdtSwapId, 'crypto')
  for (const entry of legs.values()) {
    if (entry.dolar !== 1 || entry.crypto !== 1) {
      throw new Error('Hay un intercambio con USDT incompleto.')
    }
  }
}
