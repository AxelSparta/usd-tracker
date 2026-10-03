import { describe, expect, it } from 'vitest'
import { describeImportResult, describeLocalData } from '@/features/auth/components/describe'
import {
  countLocalData,
  excludeIds,
  localNotInCloud,
  toImportPayload,
  type LocalData,
} from '@/features/auth/local-import'
import type { Coin, CryptoTransaction } from '@/features/crypto/types'
import { DolarOption } from '@/types/dolar.types'
import { TransactionType, type Transaction } from '@/types/transaction.types'

const UUID_A = '00000000-0000-4000-8000-00000000000a'
const btc: Coin = { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', image: null }
const eth: Coin = { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', image: null }

const dolar = (id: string): Transaction => ({
  id,
  type: TransactionType.BUY,
  dollarsAmount: 1,
  pesosAmount: 1000,
  date: '2026-01-01T03:00:00.000Z',
  dolarOption: DolarOption.Blue,
})
const crypto = (id: string, coinId: string, swapId?: string): CryptoTransaction => ({
  id,
  coinId,
  type: TransactionType.BUY,
  quantity: 1,
  priceUsd: 1,
  date: '2026-01-01T03:00:00.000Z',
  ...(swapId && { swapId }),
})

const local: LocalData = {
  dolar: [dolar('d1'), dolar('d2')],
  crypto: {
    transactions: [crypto('c1', 'bitcoin'), crypto('c2', 'ethereum')],
    coins: { bitcoin: btc, ethereum: eth },
  },
}

describe('local-import', () => {
  it('lo que falta subir excluye los ids que ya están en la nube y sus monedas', () => {
    const cloud: LocalData = {
      dolar: [dolar('d1')],
      crypto: { transactions: [crypto('c2', 'ethereum')], coins: { ethereum: eth } },
    }
    const pending = localNotInCloud(local, cloud)
    expect(pending.dolar.map((t) => t.id)).toEqual(['d2'])
    expect(pending.crypto.transactions.map((t) => t.id)).toEqual(['c1'])
    expect(pending.crypto.coins).toEqual({ bitcoin: btc })
    expect(countLocalData(pending)).toBe(2)
  })

  it('excludeIds sirve para las ya ofrecidas', () => {
    expect(countLocalData(excludeIds(local, new Set(['d1', 'd2', 'c1', 'c2'])))).toBe(0)
  })

  it('toImportPayload conserva los UUID y remapea el resto de forma consistente', () => {
    let n = 0
    const newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`
    const payload = toImportPayload(
      {
        dolar: [dolar(UUID_A), dolar('viejo')],
        crypto: {
          transactions: [crypto('s1', 'bitcoin', 'swap'), crypto('s2', 'ethereum', 'swap')],
          coins: { bitcoin: btc, ethereum: eth },
        },
      },
      newId,
    )
    expect(payload.dolar[0].id).toBe(UUID_A)
    expect(payload.dolar[1].id).toMatch(/^0{8}-0000-4000/)
    const [s1, s2] = payload.crypto.transactions
    expect(s1.swapId).toBe(s2.swapId)
    expect(s1.swapId).toMatch(/^0{8}-0000-4000/)
    expect(new Set([payload.dolar[1].id, s1.id, s2.id, s1.swapId]).size).toBe(4)
  })

  it('describe en español', () => {
    expect(describeLocalData(local)).toBe('4 operaciones (2 del dólar y 2 de cripto)')
    expect(describeLocalData({ dolar: [dolar('x')], crypto: { transactions: [], coins: {} } })).toBe(
      '1 operación (1 del dólar)',
    )
    expect(
      describeImportResult({ dolar: { created: 2, skipped: 1 }, crypto: { created: 1, skipped: 0 } }),
    ).toBe('Subiste 3 operaciones a tu cuenta. 1 ya estaba en la nube.')
    expect(
      describeImportResult({ dolar: { created: 0, skipped: 0 }, crypto: { created: 0, skipped: 0 } }),
    ).toBe('No había operaciones nuevas para subir.')
  })
})
