import { describe, expect, it } from 'vitest'
import {
  applyAddSwap,
  applyRemoveCryptoTransaction,
  applyUpdateCryptoTransaction,
  buildSwapLegs,
} from '@/features/crypto/operations'
import type { Coin } from '@/features/crypto/types'
import { TransactionType } from '@/types/transaction.types'

const btc: Coin = { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', image: null }
const eth: Coin = { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', image: null }
const ids = { swapId: 's', sellId: 'sell', buyId: 'buy' }
const date = new Date('2026-02-01T00:00:00')
const swap = { from: btc, fromQuantity: 0.5, to: eth, toQuantity: 10, valueUsd: 30_000, date }

const funded = {
  transactions: [
    {
      id: 'b1',
      coinId: 'bitcoin',
      type: TransactionType.BUY,
      quantity: 1,
      priceUsd: 50_000,
      date: new Date('2026-01-01T00:00:00'),
    },
  ],
  coins: { bitcoin: btc },
}

describe('buildSwapLegs', () => {
  it('usa los ids recibidos y el valor USD como precio de cada pata', () => {
    const [sell, buy] = buildSwapLegs(swap, ids)
    expect(sell).toMatchObject({ id: 'sell', coinId: 'bitcoin', type: 'SELL', priceUsd: 60_000, swapId: 's' })
    expect(buy).toMatchObject({ id: 'buy', coinId: 'ethereum', type: 'BUY', priceUsd: 3_000, swapId: 's' })
  })
})

describe('operaciones cripto', () => {
  it('borrar una pata de un intercambio informa los dos ids', () => {
    const state = applyAddSwap(funded, swap, ids)
    const result = applyRemoveCryptoTransaction(state, 'buy')
    expect(result?.removedIds.sort()).toEqual(['buy', 'sell'])
    expect(result?.state.transactions.map((t) => t.id)).toEqual(['b1'])
  })

  it('devuelve null si la operación no existe', () => {
    expect(applyRemoveCryptoTransaction(funded, 'nope')).toBeNull()
    expect(
      applyUpdateCryptoTransaction(funded, 'nope', { ...funded.transactions[0] }, btc),
    ).toBeNull()
  })

  it('no edita patas de intercambios', () => {
    const state = applyAddSwap(funded, swap, ids)
    const { id, ...leg } = state.transactions[1]
    expect(() => applyUpdateCryptoTransaction(state, 'sell', leg, btc)).toThrow(
      'Los intercambios no se editan',
    )
  })
})
