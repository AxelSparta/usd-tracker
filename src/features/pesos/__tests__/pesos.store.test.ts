import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiRequestError } from '@/lib/http'
import type { PesosMovement } from '@/features/pesos/types'
import { TransactionType } from '@/types/transaction.types'

const api = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}))
vi.mock('@/features/pesos/api', () => ({ pesosApi: api }))

const { persistedPesos, usePesosStore } = await import('@/features/pesos/pesos.store')

const income = (id: string, amount: number): PesosMovement => ({
  id,
  type: TransactionType.BUY,
  amount,
  date: '2026-01-01T03:00:00.000Z',
})
const store = () => usePesosStore.getState()

beforeEach(() => {
  vi.resetAllMocks()
  store().disconnectCloud()
  usePesosStore.setState({ movements: [] })
})

describe('usePesosStore en local', () => {
  it('agrega un ingreso con id propio y un egreso con saldo', async () => {
    await store().addMovement({ type: TransactionType.BUY, amount: 1000, date: new Date('2026-01-01T00:00:00') })
    await store().addMovement({ type: TransactionType.SELL, amount: 400, date: new Date('2026-01-02T00:00:00') })
    expect(store().movements).toHaveLength(2)
    expect(store().movements[0].id).toMatch(/^[0-9a-f-]{36}$/)
    expect(api.create).not.toHaveBeenCalled()
  })

  it('rechaza un egreso sin saldo sin tocar el estado', async () => {
    await expect(
      store().addMovement({ type: TransactionType.SELL, amount: 1, date: new Date('2026-01-01T00:00:00') }),
    ).rejects.toThrow('No tenés pesos suficientes el 01/01/2026.')
    expect(store().movements).toEqual([])
  })

  it('edita y borra', async () => {
    usePesosStore.setState({ movements: [income('a', 1000)] })
    await store().updateMovement('a', { ...income('a', 2000), note: 'Sueldo' })
    expect(store().movements[0]).toMatchObject({ id: 'a', amount: 2000, note: 'Sueldo' })
    await store().removeMovement('a')
    expect(store().movements).toEqual([])
  })
})

describe('usePesosStore en la nube', () => {
  const local = { movements: [income('local', 10)] }

  beforeEach(async () => {
    usePesosStore.setState(local)
    api.list.mockResolvedValue({ movements: [income('cloud', 1000)] })
    await store().connectCloud()
  })

  it('carga la nube y persiste la copia local', () => {
    expect(store().movements.map((m) => m.id)).toEqual(['cloud'])
    expect(persistedPesos(store())).toEqual(local)
  })

  it('manda a la API el mismo movimiento que aplicó', async () => {
    await store().addMovement({ type: TransactionType.SELL, amount: 100, date: new Date('2026-02-01T00:00:00') })
    const [sent] = api.create.mock.calls[0]
    expect(store().movements.map((m) => m.id)).toEqual(['cloud', sent.id])
  })

  it('si la API rechaza, revierte y relanza el mensaje', async () => {
    api.remove.mockRejectedValue(new ApiRequestError('No hay conexión con el servidor.', 0))
    await expect(store().removeMovement('cloud')).rejects.toThrow('No hay conexión')
    expect(store().movements.map((m) => m.id)).toEqual(['cloud'])
  })

  it('al cerrar sesión vuelve lo local', () => {
    store().disconnectCloud()
    expect(store().movements).toEqual(local.movements)
  })
})
