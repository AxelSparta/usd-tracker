import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiRequestError } from '@/lib/http'
import { DolarOption } from '@/types/dolar.types'
import { TransactionType } from '@/types/transaction.types'

const pesosApi = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }))
const conversionsApi = vi.hoisted(() => ({ create: vi.fn(), remove: vi.fn() }))
const dolarApi = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }))
vi.mock('@/features/pesos/api', () => ({ pesosApi, conversionsApi }))
vi.mock('@/services/transactionsApi', () => ({ dolarTransactionsApi: dolarApi }))

const { addConversion, removeConversion } = await import('@/features/pesos/actions')
const { usePesosStore } = await import('@/features/pesos/pesos.store')
const { useTransactionStore } = await import('@/store/transaction.store')

const income = {
  id: 'i',
  type: TransactionType.BUY,
  amount: 3_000_000,
  date: '2026-01-01T03:00:00.000Z',
}
const toBlue = {
  direction: 'PESOS_TO_DOLAR' as const,
  dolarOption: DolarOption.Blue,
  pesosAmount: 1_560_000,
  dollarsAmount: 1000,
  date: new Date('2026-02-01T00:00:00'),
}

beforeEach(async () => {
  vi.resetAllMocks()
  for (const store of [usePesosStore, useTransactionStore]) store.getState().disconnectCloud()
  pesosApi.list.mockResolvedValue({ movements: [income] })
  dolarApi.list.mockResolvedValue([])
  await Promise.all([
    usePesosStore.getState().connectCloud(),
    useTransactionStore.getState().connectCloud(),
  ])
})

describe('conversiones en la nube', () => {
  it('aplica las dos patas y manda un único request con los mismos ids', async () => {
    await addConversion(toBlue)
    expect(conversionsApi.create).toHaveBeenCalledTimes(1)
    const [, ids] = conversionsApi.create.mock.calls[0]
    expect(usePesosStore.getState().movements.map((m) => m.id)).toEqual(['i', ids.pesosId])
    expect(useTransactionStore.getState().transactions.blue?.map((t) => t.id)).toEqual([ids.dolarId])
    // Ninguno de los dos stores usa la API de su módulo
    expect(pesosApi.create).not.toHaveBeenCalled()
    expect(dolarApi.create).not.toHaveBeenCalled()
  })

  it('si el request falla, cada store revierte lo suyo', async () => {
    conversionsApi.create.mockRejectedValue(new ApiRequestError('No hay conexión con el servidor.', 0))
    await expect(addConversion(toBlue)).rejects.toThrow('No hay conexión')
    expect(usePesosStore.getState().movements.map((m) => m.id)).toEqual(['i'])
    expect(useTransactionStore.getState().transactions.blue ?? []).toEqual([])
  })

  it('borra las dos patas con un request', async () => {
    await addConversion(toBlue)
    const [, { conversionId }] = conversionsApi.create.mock.calls[0]
    await removeConversion(conversionId)
    expect(conversionsApi.remove).toHaveBeenCalledWith(conversionId)
    expect(usePesosStore.getState().movements.map((m) => m.id)).toEqual(['i'])
    expect(useTransactionStore.getState().transactions.blue).toEqual([])
  })

  it('una pata no se borra desde su módulo', async () => {
    await addConversion(toBlue)
    const [, { dolarId, pesosId }] = conversionsApi.create.mock.calls[0]
    await expect(useTransactionStore.getState().removeTransaction(dolarId)).rejects.toThrow(
      'Es una conversión de pesos: borrala completa.',
    )
    await expect(usePesosStore.getState().removeMovement(pesosId)).rejects.toThrow(
      'Es una conversión con dólares: borrala completa.',
    )
  })
})
