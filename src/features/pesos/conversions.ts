import { format } from 'date-fns'
import { findNegativeBalance, sortTxs } from '@/domain/timeline'
import { assertDolarShape, type GroupedTransactions } from '@/domain/transactions'
import { DOLAR_LABELS } from '@/lib/dolar-labels'
import type { DolarOption } from '@/types/dolar.types'
import { TransactionType, type Transaction } from '@/types/transaction.types'
import { validatePesosTimeline } from './operations'
import type { PesosMovement, PesosState } from './types'

/**
 * Conversiones pesos ↔ dólar (Fase 8.2, D9). Una conversión son dos operaciones enlazadas por
 * `conversionId`: un movimiento de Pesos y una compra o venta del módulo Dólar, con el mismo monto
 * en ARS. Para el Dólar es una compra o venta normal (entra al costo promedio y realiza ganancia).
 * Puras: las usan los stores (cliente) y la API (server). No se editan: se borran completas.
 */

/** `PESOS_TO_DOLAR`: egreso de pesos + compra de USD; `DOLAR_TO_PESOS`: venta de USD + ingreso */
export type ConversionDirection = 'PESOS_TO_DOLAR' | 'DOLAR_TO_PESOS'

export type ConversionInput = {
  direction: ConversionDirection
  dolarOption: DolarOption
  /** ARS que salen (o entran) de Pesos, con impuestos y comisiones incluidos */
  pesosAmount: number
  /** USD que entran (o salen) del tipo de dólar elegido */
  dollarsAmount: number
  date: Date | string
}

export type ConversionIds = { conversionId: string; pesosId: string; dolarId: string }

export type ConversionState = {
  pesos: PesosState
  dolar: GroupedTransactions
}

const formatDate = (date: Date | string) => format(new Date(date), 'dd/MM/yyyy')

const usdLabel = (option: DolarOption) => `USD ${DOLAR_LABELS[option] ?? option}`

/** Lanza si los USD del grupo quedan negativos en algún momento */
const assertDolarGroup = (group: Transaction[], message: (date: string) => string) => {
  const offending = findNegativeBalance(sortTxs(group), (tx) => tx.dollarsAmount)
  if (offending) throw new Error(message(formatDate(offending.date)))
}

/** `[pata pesos, pata dólar]`, con el mismo monto en ARS */
export const buildConversionLegs = (
  { direction, dolarOption, pesosAmount, dollarsAmount, date }: ConversionInput,
  { conversionId, pesosId, dolarId }: ConversionIds,
): [PesosMovement, Transaction] => {
  const toDolar = direction === 'PESOS_TO_DOLAR'
  return [
    {
      id: pesosId,
      type: toDolar ? TransactionType.SELL : TransactionType.BUY,
      amount: pesosAmount,
      date,
      conversionId,
    },
    {
      id: dolarId,
      type: toDolar ? TransactionType.BUY : TransactionType.SELL,
      pesosAmount,
      dollarsAmount,
      date,
      dolarOption,
      conversionId,
    },
  ]
}

export const applyAddConversion = (
  { pesos, dolar }: ConversionState,
  input: ConversionInput,
  ids: ConversionIds,
): ConversionState => {
  if (!(input.pesosAmount > 0) || !(input.dollarsAmount > 0)) {
    throw new Error('Los montos deben ser mayores a cero.')
  }
  const [pesosLeg, dolarLeg] = buildConversionLegs(input, ids)
  assertDolarShape(dolarLeg)

  const movements = sortTxs([...pesos.movements, pesosLeg])
  validatePesosTimeline(movements, (date) => `No tenés pesos suficientes para convertir el ${date}.`)

  const group = sortTxs([...(dolar[input.dolarOption] ?? []), dolarLeg])
  assertDolarGroup(
    group,
    (date) => `No tenés suficientes ${usdLabel(input.dolarOption)} para convertir el ${date}.`,
  )

  return {
    pesos: { movements },
    dolar: { ...dolar, [input.dolarOption]: group },
  }
}

/**
 * Quita las dos patas y revalida las dos líneas: los USD comprados pueden haberse vendido y los
 * pesos cobrados, gastado. `null` si la conversión no existe.
 */
export const applyRemoveConversion = (
  { pesos, dolar }: ConversionState,
  conversionId: string,
): { state: ConversionState; removedIds: string[] } | null => {
  const pesosLegs = pesos.movements.filter((m) => m.conversionId === conversionId)
  const dolarLegs = Object.values(dolar)
    .flatMap((group) => group ?? [])
    .filter((tx) => tx.conversionId === conversionId)
  if (pesosLegs.length + dolarLegs.length === 0) return null

  const movements = pesos.movements.filter((m) => m.conversionId !== conversionId)
  validatePesosTimeline(
    movements,
    (date) => `No se puede eliminar: el egreso de pesos del ${date} quedaría sin saldo.`,
  )

  const nextDolar: GroupedTransactions = { ...dolar }
  for (const option of new Set(dolarLegs.map((tx) => tx.dolarOption))) {
    const group = (dolar[option] ?? []).filter((tx) => tx.conversionId !== conversionId)
    assertDolarGroup(
      group,
      (date) => `No se puede eliminar: la venta de ${usdLabel(option)} del ${date} quedaría sin saldo.`,
    )
    nextDolar[option] = group
  }

  return {
    state: { pesos: { movements }, dolar: nextDolar },
    removedIds: [...pesosLegs, ...dolarLegs].map((leg) => leg.id),
  }
}

/**
 * Para la importación: cada `conversionId` tiene exactamente una pata en cada módulo, de tipos
 * opuestos y con el mismo monto en ARS. Una pata suelta dejaría un saldo sin su contraparte.
 */
export const assertConversionsComplete = (dolar: Transaction[], pesos: PesosMovement[]) => {
  const legs = new Map<string, { dolar: Transaction[]; pesos: PesosMovement[] }>()
  const entry = (id: string) => {
    if (!legs.has(id)) legs.set(id, { dolar: [], pesos: [] })
    return legs.get(id)!
  }
  for (const tx of dolar) if (tx.conversionId) entry(tx.conversionId).dolar.push(tx)
  for (const m of pesos) if (m.conversionId) entry(m.conversionId).pesos.push(m)

  for (const { dolar: [dolarLeg, ...extraDolar], pesos: [pesosLeg, ...extraPesos] } of legs.values()) {
    const complete =
      dolarLeg &&
      pesosLeg &&
      extraDolar.length === 0 &&
      extraPesos.length === 0 &&
      dolarLeg.type !== pesosLeg.type &&
      // Mismo monto en ARS (tolerancia por la ida y vuelta por JSON / Decimal)
      Math.abs(dolarLeg.pesosAmount - pesosLeg.amount) < 0.005
    if (!complete) throw new Error('Hay una conversión de pesos incompleta.')
  }
}
