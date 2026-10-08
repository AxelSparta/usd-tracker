import { format } from 'date-fns'
import { findNegativeBalance, sortTxs } from '@/domain/timeline'
import { assertDolarShape, type GroupedTransactions } from '@/domain/transactions'
import { assertPesosShape, validatePesosTimeline } from '@/features/pesos/operations'
import type { PesosMovement, PesosState } from '@/features/pesos/types'
import { DolarOption } from '@/types/dolar.types'
import { TransactionType, type Transaction } from '@/types/transaction.types'
import { cedearTotal } from './metrics'
import type { CedearLegOwner, CedearState, CedearTransaction } from './types'

/**
 * Operaciones del módulo CEDEARs. Puras: las usan el store (cliente) y la API (server).
 * Cada operación tiene **una** pata que mueve su dinero (D8): un movimiento de Pesos si se pagó
 * en ARS o una operación del grupo `contadoconliqui` del Dólar si se pagó en CCL. La pata guarda
 * el id de la operación en `cedearId`.
 */

export const CEDEAR_LEGS_INCOMPLETE = 'Hay una operación de CEDEAR sin su pata de pesos o de dólares CCL.'

/**
 * Para la importación: cada operación tiene exactamente una pata, en el módulo que corresponde a
 * su moneda y del tipo contrario (comprar un CEDEAR es un egreso de pesos o una venta de CCL), y
 * cada `cedearId` apunta a una operación. Que la pata del Dólar vaya en el CCL lo valida
 * `assertDolarShape`.
 */
export const assertCedearLegsComplete = (
  cedears: CedearLegOwner[],
  dolar: Transaction[],
  pesos: PesosMovement[],
) => {
  const legs = new Map<string, { dolar: Transaction[]; pesos: PesosMovement[] }>(
    cedears.map((op) => [op.id, { dolar: [], pesos: [] }]),
  )
  for (const tx of dolar) {
    if (!tx.cedearId) continue
    const entry = legs.get(tx.cedearId)
    if (!entry) throw new Error(CEDEAR_LEGS_INCOMPLETE)
    entry.dolar.push(tx)
  }
  for (const m of pesos) {
    if (!m.cedearId) continue
    const entry = legs.get(m.cedearId)
    if (!entry) throw new Error(CEDEAR_LEGS_INCOMPLETE)
    entry.pesos.push(m)
  }

  for (const op of cedears) {
    const { dolar: dolarLegs, pesos: pesosLegs } = legs.get(op.id)!
    const [leg, ...extra] = op.currency === 'ARS' ? pesosLegs : dolarLegs
    const other = op.currency === 'ARS' ? dolarLegs : pesosLegs
    if (!leg || extra.length > 0 || other.length > 0 || leg.type === op.type) {
      throw new Error(CEDEAR_LEGS_INCOMPLETE)
    }
  }
}

/** Los tres módulos que toca una operación de CEDEAR */
export type CedearLinkedState = {
  cedears: CedearState
  pesos: PesosState
  dolar: GroupedTransactions
}

/** La pata, en el módulo que corresponde a la moneda de la operación */
export type FundingLeg =
  | { module: 'pesos'; leg: PesosMovement }
  | { module: 'dolar'; leg: Transaction }

const CCL = DolarOption.ContadoConLiqui

const formatDate = (date: Date | string) => format(new Date(date), 'dd/MM/yyyy')

const opposite = (type: TransactionType) =>
  type === TransactionType.BUY ? TransactionType.SELL : TransactionType.BUY

/** Cantidad entera, precio, CCL y total positivos; comisión ≥ 0 (la API y el form ya lo validan) */
export const assertCedearShape = (tx: Omit<CedearTransaction, 'id'>) => {
  if (!tx.ticker.trim()) throw new Error('Elegí un CEDEAR.')
  if (!Number.isInteger(tx.quantity) || tx.quantity <= 0) {
    throw new Error('La cantidad debe ser un número entero de CEDEARs.')
  }
  if (!(tx.price > 0)) throw new Error('El precio debe ser mayor a cero.')
  if (!(tx.fxRate > 0)) throw new Error('El CCL debe ser mayor a cero.')
  if (tx.fee !== undefined && !(tx.fee >= 0)) throw new Error('La comisión no puede ser negativa.')
  if (!(cedearTotal(tx) > 0)) throw new Error('La comisión no puede superar el total de la venta.')
}

/**
 * La pata que mueve el dinero: con ARS, egreso de Pesos (compra) o ingreso (venta) por el total;
 * con CCL, venta (compra de CEDEAR) o compra (venta de CEDEAR) de USD en el grupo `contadoconliqui`
 * por el total en USD, con `pesosAmount` = USD × `fxRate`. Lleva `id` propio y `cedearId` = `tx.id`.
 */
export const buildFundingLeg = (tx: CedearTransaction, legId: string): FundingLeg => {
  const total = cedearTotal(tx)
  const type = opposite(tx.type)
  return tx.currency === 'ARS'
    ? { module: 'pesos', leg: { id: legId, type, amount: total, date: tx.date, cedearId: tx.id } }
    : {
        module: 'dolar',
        leg: {
          id: legId,
          type,
          pesosAmount: total * tx.fxRate,
          dollarsAmount: total,
          date: tx.date,
          dolarOption: CCL,
          cedearId: tx.id,
        },
      }
}

/** La pata actual de una operación, o `null` si no está (datos incompletos) */
export const findFundingLeg = (
  { pesos, dolar }: Pick<CedearLinkedState, 'pesos' | 'dolar'>,
  cedearId: string,
): FundingLeg | null => {
  const movement = pesos.movements.find((m) => m.cedearId === cedearId)
  if (movement) return { module: 'pesos', leg: movement }
  const tx = Object.values(dolar)
    .flatMap((group) => group ?? [])
    .find((t) => t.cedearId === cedearId)
  return tx ? { module: 'dolar', leg: tx } : null
}

type Mode = 'save' | 'remove'

const validateUnits = (txs: CedearTransaction[], ticker: string, mode: Mode) => {
  const offending = findNegativeBalance(
    sortTxs(txs.filter((t) => t.ticker === ticker)),
    (t) => t.quantity,
  )
  if (!offending) return
  const date = formatDate(offending.date)
  throw new Error(
    mode === 'save'
      ? `No tenés suficientes ${ticker} el ${date}.`
      : `No se puede eliminar: la venta de ${ticker} del ${date} quedaría sin CEDEARs.`,
  )
}

const validateCcl = (group: Transaction[], mode: Mode) => {
  const offending = findNegativeBalance(sortTxs(group), (t) => t.dollarsAmount)
  if (!offending) return
  const date = formatDate(offending.date)
  throw new Error(
    mode === 'save'
      ? `No tenés suficientes USD CCL el ${date}.`
      : `No se puede eliminar: la venta de USD CCL del ${date} quedaría sin saldo.`,
  )
}

/**
 * Saca la pata anterior (si hay) y pone la nueva (si hay), y revalida cada módulo que cambió:
 * al editar con cambio de moneda, la pata se mueve de Pesos al Dólar CCL o al revés.
 */
const replaceLeg = (
  { pesos, dolar }: Pick<CedearLinkedState, 'pesos' | 'dolar'>,
  previous: FundingLeg | null,
  next: FundingLeg | null,
  mode: Mode,
): Pick<CedearLinkedState, 'pesos' | 'dolar'> => {
  const touches = (module: FundingLeg['module']) =>
    previous?.module === module || next?.module === module
  let nextPesos = pesos
  let nextDolar = dolar

  if (touches('pesos')) {
    const movements = sortTxs([
      ...pesos.movements.filter((m) => previous?.module !== 'pesos' || m.id !== previous.leg.id),
      ...(next?.module === 'pesos' ? [next.leg] : []),
    ])
    validatePesosTimeline(
      movements,
      mode === 'save'
        ? (date) => `No tenés pesos suficientes el ${date}.`
        : (date) => `No se puede eliminar: el egreso de pesos del ${date} quedaría sin saldo.`,
    )
    nextPesos = { movements }
  }

  if (touches('dolar')) {
    const group = sortTxs([
      ...(dolar[CCL] ?? []).filter((t) => previous?.module !== 'dolar' || t.id !== previous.leg.id),
      ...(next?.module === 'dolar' ? [next.leg] : []),
    ])
    validateCcl(group, mode)
    nextDolar = { ...dolar, [CCL]: group }
  }

  return { pesos: nextPesos, dolar: nextDolar }
}

const assertLegShape = (funding: FundingLeg) =>
  funding.module === 'pesos' ? assertPesosShape(funding.leg) : assertDolarShape(funding.leg)

export type CedearIds = { id: string; legId: string }

/** Agrega la operación y su pata; valida unidades del CEDEAR y el saldo de pesos o de USD CCL */
export const applyAddCedearTransaction = (
  state: CedearLinkedState,
  input: Omit<CedearTransaction, 'id'>,
  { id, legId }: CedearIds,
): { state: CedearLinkedState; leg: FundingLeg } => {
  assertCedearShape(input)
  const tx: CedearTransaction = { id, ...input }
  const leg = buildFundingLeg(tx, legId)
  assertLegShape(leg)

  const transactions = sortTxs([...state.cedears.transactions, tx])
  validateUnits(transactions, tx.ticker, 'save')

  return {
    state: { cedears: { transactions }, ...replaceLeg(state, null, leg, 'save') },
    leg,
  }
}

/**
 * Edita la operación y reconstruye su pata con el mismo id (D6): revalida el CEDEAR (y el ticker
 * anterior si cambió) y cada módulo de dinero afectado. `null` si la operación no existe.
 */
export const applyUpdateCedearTransaction = (
  state: CedearLinkedState,
  id: string,
  input: Omit<CedearTransaction, 'id'>,
): { state: CedearLinkedState; leg: FundingLeg; previous: FundingLeg } | null => {
  const current = state.cedears.transactions.find((t) => t.id === id)
  if (!current) return null
  const previous = findFundingLeg(state, id)
  if (!previous) throw new Error(CEDEAR_LEGS_INCOMPLETE)
  assertCedearShape(input)

  const tx: CedearTransaction = { id, ...input }
  const leg = buildFundingLeg(tx, previous.leg.id)
  assertLegShape(leg)

  const transactions = sortTxs(state.cedears.transactions.map((t) => (t.id === id ? tx : t)))
  validateUnits(transactions, tx.ticker, 'save')
  if (current.ticker !== tx.ticker) validateUnits(transactions, current.ticker, 'save')

  return {
    state: { cedears: { transactions }, ...replaceLeg(state, previous, leg, 'save') },
    leg,
    previous,
  }
}

/** Borra la operación y su pata; revalida las tres líneas. `null` si la operación no existe. */
export const applyRemoveCedearTransaction = (
  state: CedearLinkedState,
  id: string,
): { state: CedearLinkedState; previous: FundingLeg | null } | null => {
  const current = state.cedears.transactions.find((t) => t.id === id)
  if (!current) return null
  // Sin pata (no debería pasar: la importación lo rechaza) igual se puede borrar la operación
  const previous = findFundingLeg(state, id)

  const transactions = state.cedears.transactions.filter((t) => t.id !== id)
  validateUnits(transactions, current.ticker, 'remove')

  return {
    state: { cedears: { transactions }, ...replaceLeg(state, previous, null, 'remove') },
    previous,
  }
}

/** Unidades del CEDEAR nunca negativas, por ticker (importación y carga desde la nube) */
export const validateCedearTimelines = (txs: CedearTransaction[]) => {
  for (const ticker of new Set(txs.map((t) => t.ticker))) validateUnits(txs, ticker, 'save')
}
