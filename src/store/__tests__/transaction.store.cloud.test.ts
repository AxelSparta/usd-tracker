import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiRequestError } from '@/lib/http'
import { DolarOption } from '@/types/dolar.types'
import { TransactionType, type Transaction } from '@/types/transaction.types'

const api = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}))
vi.mock('@/services/transactionsApi', () => ({ dolarTransactionsApi: api }))

const { persistedTransactions, useTransactionStore } = await import('@/store/transaction.store')

const tx = (id: string, type: TransactionType, dollarsAmount: number, date: string): Transaction => ({
  id,
  type,
  dollarsAmount,
  pesosAmount: dollarsAmount * 1000,
  date,
  dolarOption: DolarOption.Blue,
})
const localBuy = tx('local', TransactionType.BUY, 5, '2026-01-01T03:00:00.000Z')
const cloudBuy = tx('cloud', TransactionType.BUY, 100, '2026-01-01T03:00:00.000Z')
const input = (type: TransactionType, dollarsAmount: number, date = '2026-02-01T03:00:00.000Z') => {
  const { id, ...rest } = tx('x', type, dollarsAmount, date)
  return rest
}

const store = () => useTransactionStore.getState()
const ids = () => (store().transactions.blue ?? []).map((t) => t.id)
/** Lo que `persist` escribiría en localStorage */
const persisted = () => persistedTransactions(store())

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)))
  return { promise, resolve, reject }
}

beforeEach(() => {
  vi.resetAllMocks()
  store().disconnectCloud()
  useTransactionStore.setState({ transactions: { blue: [localBuy] } })
  api.list.mockResolvedValue([cloudBuy])
})

describe('origen de datos', () => {
  it('arranca en pending hasta que se resuelve la sesión', async () => {
    vi.resetModules()
    const fresh = await import('@/store/transaction.store')
    expect(fresh.useTransactionStore.getState().status).toBe('pending')
  })

  it('con sesión carga la nube y sigue persistiendo la copia local', async () => {
    const loading = store().connectCloud()
    expect(store().status).toBe('loading')
    expect(ids()).toEqual([])
    await loading

    expect(store()).toMatchObject({ source: 'cloud', status: 'ready' })
    expect(ids()).toEqual(['cloud'])
    expect(persisted()).toEqual({ transactions: { blue: [localBuy] } })
  })

  it('al cerrar sesión vuelve la copia local', async () => {
    await store().connectCloud()
    store().disconnectCloud()
    expect(store()).toMatchObject({ source: 'local', status: 'ready', localSnapshot: null })
    expect(ids()).toEqual(['local'])
  })

  it('ignora una carga que termina después de cerrar sesión', async () => {
    const list = deferred<Transaction[]>()
    api.list.mockReturnValue(list.promise)
    const loading = store().connectCloud()
    store().disconnectCloud()
    list.resolve([cloudBuy])
    await loading
    expect(ids()).toEqual(['local'])
  })

  it('error de carga → status error; reintentar recupera', async () => {
    api.list.mockRejectedValueOnce(new ApiRequestError('boom', 500))
    await store().connectCloud()
    expect(store().status).toBe('error')
    await store().retryCloud()
    expect(store().status).toBe('ready')
    expect(ids()).toEqual(['cloud'])
  })
})

describe('escrituras en la nube', () => {
  beforeEach(async () => {
    await store().connectCloud()
  })

  it('aplica el alta al instante y la confirma con la API (mismo id)', async () => {
    const pending = store().addTransaction(input(TransactionType.SELL, 40))
    expect(ids()).toHaveLength(2) // optimista
    await pending
    const created = api.create.mock.calls[0][0] as Transaction
    expect(ids()).toContain(created.id)
    expect(persisted()).toEqual({ transactions: { blue: [localBuy] } })
  })

  it('si la API rechaza, revierte y relanza su mensaje', async () => {
    api.create.mockRejectedValue(new ApiRequestError('La operación ya existe.', 409))
    await expect(store().addTransaction(input(TransactionType.BUY, 1))).rejects.toThrow(
      'La operación ya existe.',
    )
    expect(ids()).toEqual(['cloud'])
  })

  it('valida en el cliente antes de llamar a la API', async () => {
    await expect(store().addTransaction(input(TransactionType.SELL, 500))).rejects.toThrow(
      /saldo de USD quedaría negativo/,
    )
    expect(api.create).not.toHaveBeenCalled()
  })

  it('si otra escritura cambió el estado, no revierte: recarga desde la nube', async () => {
    const first = deferred<void>()
    api.create.mockReturnValueOnce(first.promise).mockResolvedValueOnce(undefined)
    const failing = store().addTransaction(input(TransactionType.BUY, 1))
    await store().addTransaction(input(TransactionType.BUY, 2))
    api.list.mockResolvedValue([cloudBuy])

    first.reject(new ApiRequestError('Error 500', 500))
    await expect(failing).rejects.toThrow('Error 500')
    await vi.waitFor(() => expect(ids()).toEqual(['cloud']))
    expect(api.list).toHaveBeenCalledTimes(2)
  })

  it('edición y borrado llaman a la API con el id', async () => {
    await store().updateTransaction('cloud', input(TransactionType.BUY, 150, cloudBuy.date as string))
    expect(api.update).toHaveBeenCalledWith('cloud', expect.objectContaining({ dollarsAmount: 150 }))
    await store().removeTransaction('cloud')
    expect(api.remove).toHaveBeenCalledWith('cloud')
    expect(ids()).toEqual([])
  })
})

describe('modo local', () => {
  it('no llama a la API', async () => {
    store().disconnectCloud()
    await store().addTransaction(input(TransactionType.BUY, 1))
    expect(api.create).not.toHaveBeenCalled()
    expect(persisted().transactions).toEqual(store().transactions)
  })
})
