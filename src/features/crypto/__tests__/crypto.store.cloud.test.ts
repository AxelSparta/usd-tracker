import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiRequestError } from '@/lib/http'
import type { Coin, CryptoTransaction } from '@/features/crypto/types'
import { TransactionType } from '@/types/transaction.types'

const api = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  createSwap: vi.fn(),
  remove: vi.fn(),
}))
vi.mock('@/features/crypto/api', () => ({ cryptoApi: api }))

const { persistedCrypto, useCryptoStore } = await import('@/features/crypto/crypto.store')

const btc: Coin = { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', image: null }
const eth: Coin = { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', image: null }
const buy = (id: string, quantity: number): CryptoTransaction => ({
  id,
  coinId: 'bitcoin',
  type: TransactionType.BUY,
  quantity,
  priceUsd: 50_000,
  date: '2026-01-01T03:00:00.000Z',
})
const local = { transactions: [buy('local', 0.1)], coins: { bitcoin: btc } }
const store = () => useCryptoStore.getState()

beforeEach(async () => {
  vi.resetAllMocks()
  store().disconnectCloud()
  useCryptoStore.setState(local)
  api.list.mockResolvedValue({ transactions: [buy('cloud', 1)], coins: { bitcoin: btc } })
  await store().connectCloud()
})

describe('useCryptoStore en la nube', () => {
  it('carga la nube y persiste la copia local', () => {
    expect(store().transactions.map((t) => t.id)).toEqual(['cloud'])
    expect(persistedCrypto(store())).toEqual(local)
  })

  it('intercambio: manda los mismos ids que aplicó en el estado', async () => {
    await store().addSwap({ from: btc, fromQuantity: 0.5, to: eth, toQuantity: 10, valueUsd: 30_000, date: new Date('2026-02-01T00:00:00') })
    const [, sentIds] = api.createSwap.mock.calls[0]
    expect(store().transactions.map((t) => t.id).sort()).toEqual(
      ['cloud', sentIds.sellId, sentIds.buyId].sort(),
    )
    expect(store().coins.ethereum).toEqual(eth)
  })

  it('borrar un intercambio rechazado por la API revierte las dos patas', async () => {
    await store().addSwap({ from: btc, fromQuantity: 0.5, to: eth, toQuantity: 10, valueUsd: 30_000, date: new Date('2026-02-01T00:00:00') })
    api.remove.mockRejectedValue(new ApiRequestError('No hay conexión con el servidor.', 0))
    const leg = store().transactions.find((t) => t.swapId)!
    await expect(store().removeTransaction(leg.id)).rejects.toThrow('No hay conexión')
    expect(store().transactions).toHaveLength(3)
  })
})
