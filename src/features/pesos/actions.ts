import { commitAcross, write } from '@/lib/synced-store'
import { useTransactionStore } from '@/store/transaction.store'
import { conversionsApi } from './api'
import {
  applyAddConversion,
  applyRemoveConversion,
  type ConversionInput,
  type ConversionState,
} from './conversions'
import { usePesosStore } from './pesos.store'

/**
 * Conversiones pesos ↔ dólar: tocan el store de Pesos y el del Dólar. Validan con las funciones
 * puras sobre el estado actual, aplican los dos cambios al instante y, con sesión, los confirman
 * con **una** llamada a la API; si falla, cada store revierte lo suyo y el error se relanza.
 */

/** Los dos stores con su origen resuelto y sus datos cargados */
const bothReady = () =>
  Promise.all([usePesosStore.getState().whenReady(), useTransactionStore.getState().whenReady()])

const currentState = (): ConversionState => ({
  pesos: { movements: usePesosStore.getState().movements },
  dolar: useTransactionStore.getState().transactions,
})

const commitBoth = (next: ConversionState, remote: () => Promise<unknown>) =>
  commitAcross(
    [write(usePesosStore, next.pesos), write(useTransactionStore, { transactions: next.dolar })],
    remote,
  )

export const addConversion = async (conversion: ConversionInput) => {
  await bothReady()
  const ids = {
    conversionId: crypto.randomUUID(),
    pesosId: crypto.randomUUID(),
    dolarId: crypto.randomUUID(),
  }
  const next = applyAddConversion(currentState(), conversion, ids)
  await commitBoth(next, () => conversionsApi.create(conversion, ids))
}

export const removeConversion = async (conversionId: string) => {
  await bothReady()
  const result = applyRemoveConversion(currentState(), conversionId)
  if (!result) return
  await commitBoth(result.state, () => conversionsApi.remove(conversionId))
}
