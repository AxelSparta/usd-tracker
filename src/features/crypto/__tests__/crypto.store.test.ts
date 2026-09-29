import { beforeEach, describe, expect, it } from 'vitest'
import { useCryptoStore } from '@/features/crypto/crypto.store'
import type { Coin } from '@/features/crypto/types'
import { TransactionType } from '@/types/transaction.types'

const btc: Coin = { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', image: null }
// Fechas locales, como las que entrega el <Calendar> del formulario
const day = (iso: string) => new Date(`${iso}T00:00:00`)
const add = (type: TransactionType, quantity: number, iso: string) =>
  useCryptoStore
    .getState()
    .addTransaction({ coinId: 'bitcoin', type, quantity, priceUsd: 50_000, date: day(iso) }, btc)

describe('useCryptoStore', () => {
  beforeEach(() => useCryptoStore.setState({ transactions: [], coins: {} }))

  it('guarda la operación y los metadatos de la moneda', () => {
    add(TransactionType.BUY, 1, '2026-01-01')
    const { transactions, coins } = useCryptoStore.getState()
    expect(transactions).toHaveLength(1)
    expect(coins.bitcoin).toEqual(btc)
  })

  it('rechaza vender más de lo que se tenía a esa fecha', () => {
    add(TransactionType.BUY, 1, '2026-02-01')
    expect(() => add(TransactionType.SELL, 0.5, '2026-01-15')).toThrow(
      'No tenés suficiente BTC para vender el 15/01/2026.',
    )
    expect(useCryptoStore.getState().transactions).toHaveLength(1)
  })

  it('rechaza borrar una compra que deja una venta sin saldo', () => {
    add(TransactionType.BUY, 1, '2026-01-01')
    add(TransactionType.SELL, 1, '2026-02-01')
    const buyId = useCryptoStore.getState().transactions[0].id
    expect(() => useCryptoStore.getState().removeTransaction(buyId)).toThrow(
      /No se puede eliminar/,
    )
  })

  it('borra la venta sin problemas', () => {
    add(TransactionType.BUY, 1, '2026-01-01')
    add(TransactionType.SELL, 1, '2026-02-01')
    const sellId = useCryptoStore.getState().transactions[1].id
    useCryptoStore.getState().removeTransaction(sellId)
    expect(useCryptoStore.getState().transactions).toHaveLength(1)
  })
})

describe('updateTransaction', () => {
  beforeEach(() => useCryptoStore.setState({ transactions: [], coins: {} }))

  const eth: Coin = { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', image: null }

  it('edita la operación conservando el id', () => {
    add(TransactionType.BUY, 1, '2026-01-01')
    const [tx] = useCryptoStore.getState().transactions
    useCryptoStore.getState().updateTransaction(
      tx.id,
      { ...tx, quantity: 2, priceUsd: 40_000 },
      btc,
    )
    expect(useCryptoStore.getState().transactions).toEqual([
      { ...tx, quantity: 2, priceUsd: 40_000 },
    ])
  })

  it('rechaza reducir una compra por debajo de lo vendido después', () => {
    add(TransactionType.BUY, 1, '2026-01-01')
    add(TransactionType.SELL, 1, '2026-02-01')
    const [buy] = useCryptoStore.getState().transactions
    expect(() =>
      useCryptoStore.getState().updateTransaction(buy.id, { ...buy, quantity: 0.5 }, btc),
    ).toThrow('No tenés suficiente BTC para la venta del 01/02/2026.')
  })

  it('cambiar de moneda revalida la moneda de origen', () => {
    add(TransactionType.BUY, 1, '2026-01-01')
    add(TransactionType.SELL, 1, '2026-02-01')
    const [buy] = useCryptoStore.getState().transactions
    expect(() =>
      useCryptoStore
        .getState()
        .updateTransaction(buy.id, { ...buy, coinId: 'ethereum' }, eth),
    ).toThrow(/No se puede cambiar: la venta de BTC/)
  })

  it('cambiar de moneda guarda los metadatos de la nueva', () => {
    add(TransactionType.BUY, 1, '2026-01-01')
    const [buy] = useCryptoStore.getState().transactions
    useCryptoStore.getState().updateTransaction(buy.id, { ...buy, coinId: 'ethereum' }, eth)
    expect(useCryptoStore.getState().coins.ethereum).toEqual(eth)
  })
})
