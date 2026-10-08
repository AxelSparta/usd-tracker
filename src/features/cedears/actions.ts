import { usePesosStore } from '@/features/pesos/pesos.store'
import { commitAcross, write } from '@/lib/synced-store'
import { useTransactionStore } from '@/store/transaction.store'
import { cedearsApi } from './api'
import { useCedearsStore } from './cedears.store'
import {
  applyAddCedearTransaction,
  applyRemoveCedearTransaction,
  applyUpdateCedearTransaction,
  type CedearLinkedState,
} from './operations'
import type { CedearTransaction } from './types'

/**
 * Alta, edición y borrado de CEDEARs: tocan su store y el de Pesos o el del Dólar (la pata, D8).
 * Validan con las funciones puras sobre el estado actual, aplican los cambios al instante y, con
 * sesión, los confirman con **una** llamada a la API; si falla, cada store revierte lo suyo y el
 * error se relanza para el toast.
 */

/** Los tres stores con su origen resuelto y sus datos cargados */
const allReady = () =>
  Promise.all([
    useCedearsStore.getState().whenReady(),
    usePesosStore.getState().whenReady(),
    useTransactionStore.getState().whenReady(),
  ])

const currentState = (): CedearLinkedState => ({
  cedears: { transactions: useCedearsStore.getState().transactions },
  pesos: { movements: usePesosStore.getState().movements },
  dolar: useTransactionStore.getState().transactions,
})

/** Escribe solo en los stores que cambiaron (una compra con pesos no toca el Dólar) */
const commitAll = (
  current: CedearLinkedState,
  next: CedearLinkedState,
  remote: () => Promise<unknown>,
) =>
  commitAcross(
    [
      write(useCedearsStore, next.cedears),
      ...(next.pesos !== current.pesos ? [write(usePesosStore, next.pesos)] : []),
      ...(next.dolar !== current.dolar
        ? [write(useTransactionStore, { transactions: next.dolar })]
        : []),
    ],
    remote,
  )

export const addCedearTransaction = async (input: Omit<CedearTransaction, 'id'>) => {
  await allReady()
  const ids = { id: crypto.randomUUID(), legId: crypto.randomUUID() }
  const current = currentState()
  const { state } = applyAddCedearTransaction(current, input, ids)
  await commitAll(current, state, () => cedearsApi.create(input, ids))
}

export const updateCedearTransaction = async (
  id: string,
  input: Omit<CedearTransaction, 'id'>,
) => {
  await allReady()
  const current = currentState()
  const result = applyUpdateCedearTransaction(current, id, input)
  if (!result) return
  await commitAll(current, result.state, () => cedearsApi.update(id, input))
}

export const removeCedearTransaction = async (id: string) => {
  await allReady()
  const current = currentState()
  const result = applyRemoveCedearTransaction(current, id)
  if (!result) return
  await commitAll(current, result.state, () => cedearsApi.remove(id))
}
