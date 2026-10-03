import { useCryptoStore } from '@/features/crypto/crypto.store'
import { useTransactionStore } from '@/store/transaction.store'
import { usdtSwapsApi } from './api'
import {
  applyAddUsdtSwap,
  applyRemoveUsdtSwap,
  type LinkedState,
  type UsdtSwapInput,
} from './operations'

/**
 * Escrituras que tocan los dos stores. Validan con las funciones puras sobre el estado actual,
 * aplican los dos cambios al instante y, con sesión, los confirman con **una** llamada a la API:
 * si falla, cada store revierte lo suyo y el error se relanza para el toast.
 */

/** Los dos stores con su origen resuelto y sus datos cargados */
const bothReady = () =>
  Promise.all([useTransactionStore.getState().whenReady(), useCryptoStore.getState().whenReady()])

const currentState = (): LinkedState => {
  const { transactions, coins } = useCryptoStore.getState()
  return { dolar: useTransactionStore.getState().transactions, crypto: { transactions, coins } }
}

/** Los dos stores llaman a `remote` (solo con sesión): que salga un único request */
const once = <T>(request: () => Promise<T>) => {
  let pending: Promise<T> | undefined
  return () => (pending ??= request())
}

const commitBoth = async (next: LinkedState, remote: () => Promise<unknown>) => {
  const request = once(remote)
  await Promise.all([
    useTransactionStore.getState().applyExternal({ transactions: next.dolar }, request),
    useCryptoStore.getState().applyExternal(next.crypto, request),
  ])
}

export const addUsdtSwap = async (swap: UsdtSwapInput) => {
  await bothReady()
  const ids = {
    usdtSwapId: crypto.randomUUID(),
    dolarId: crypto.randomUUID(),
    cryptoId: crypto.randomUUID(),
  }
  const next = applyAddUsdtSwap(currentState(), swap, ids)
  await commitBoth(next, () => usdtSwapsApi.create(swap, ids))
}

export const removeUsdtSwap = async (usdtSwapId: string) => {
  await bothReady()
  const result = applyRemoveUsdtSwap(currentState(), usdtSwapId)
  if (!result) return
  await commitBoth(result.state, () => usdtSwapsApi.remove(usdtSwapId))
}
