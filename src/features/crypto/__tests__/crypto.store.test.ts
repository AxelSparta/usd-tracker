import { beforeEach, describe, expect, it } from 'vitest'
import { migrateCryptoStorage, useCryptoStore } from '@/features/crypto/crypto.store'
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

  it('rechaza vender más de lo que se tenía a esa fecha', async () => {
    add(TransactionType.BUY, 1, '2026-02-01')
    await expect( add(TransactionType.SELL, 0.5, '2026-01-15')).rejects.toThrow(
      'No tenés suficiente BTC para vender el 15/01/2026.',
    )
    expect(useCryptoStore.getState().transactions).toHaveLength(1)
  })

  it('rechaza borrar una compra que deja una venta sin saldo', async () => {
    add(TransactionType.BUY, 1, '2026-01-01')
    add(TransactionType.SELL, 1, '2026-02-01')
    const buyId = useCryptoStore.getState().transactions[0].id
    await expect( useCryptoStore.getState().removeTransaction(buyId)).rejects.toThrow(
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

  it('rechaza reducir una compra por debajo de lo vendido después', async () => {
    add(TransactionType.BUY, 1, '2026-01-01')
    add(TransactionType.SELL, 1, '2026-02-01')
    const [buy] = useCryptoStore.getState().transactions
    await expect(
      useCryptoStore.getState().updateTransaction(buy.id, { ...buy, quantity: 0.5 }, btc),
    ).rejects.toThrow('No tenés suficiente BTC para la venta del 01/02/2026.')
  })

  it('cambiar de moneda revalida la moneda de origen', async () => {
    add(TransactionType.BUY, 1, '2026-01-01')
    add(TransactionType.SELL, 1, '2026-02-01')
    const [buy] = useCryptoStore.getState().transactions
    await expect(
      useCryptoStore
        .getState()
        .updateTransaction(buy.id, { ...buy, coinId: 'ethereum' }, eth),
    ).rejects.toThrow(/No se puede cambiar: la venta de BTC/)
  })

  it('cambiar de moneda guarda los metadatos de la nueva', () => {
    add(TransactionType.BUY, 1, '2026-01-01')
    const [buy] = useCryptoStore.getState().transactions
    useCryptoStore.getState().updateTransaction(buy.id, { ...buy, coinId: 'ethereum' }, eth)
    expect(useCryptoStore.getState().coins.ethereum).toEqual(eth)
  })
})

describe('comisiones en la línea temporal', () => {
  beforeEach(() => useCryptoStore.setState({ transactions: [], coins: {} }))

  it('la comisión en la moneda de la compra reduce el saldo disponible', async () => {
    useCryptoStore.getState().addTransaction(
      {
        coinId: 'bitcoin',
        type: TransactionType.BUY,
        quantity: 1,
        priceUsd: 50_000,
        date: day('2026-01-01'),
        fee: { amount: 0.01, currency: 'COIN' },
      },
      btc,
    )
    await expect( add(TransactionType.SELL, 1, '2026-02-01')).rejects.toThrow(/No tenés suficiente BTC/)
    await expect( add(TransactionType.SELL, 0.99, '2026-02-01')).resolves.toBeUndefined()
  })
})

describe('intercambios', () => {
  beforeEach(() => useCryptoStore.setState({ transactions: [], coins: {} }))

  const eth: Coin = { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', image: null }
  const swap = (fromQuantity: number, iso: string) =>
    useCryptoStore.getState().addSwap({
      from: btc,
      fromQuantity,
      to: eth,
      toQuantity: 10,
      valueUsd: 30_000,
      date: day(iso),
    })

  it('guarda una venta y una compra enlazadas con precios derivados del valor', () => {
    add(TransactionType.BUY, 1, '2026-01-01')
    swap(0.5, '2026-02-01')
    const [, sellLeg, buyLeg] = useCryptoStore.getState().transactions
    expect(sellLeg).toMatchObject({ coinId: 'bitcoin', type: TransactionType.SELL, priceUsd: 60_000 })
    expect(buyLeg).toMatchObject({ coinId: 'ethereum', type: TransactionType.BUY, priceUsd: 3_000 })
    expect(sellLeg.swapId).toBeDefined()
    expect(sellLeg.swapId).toBe(buyLeg.swapId)
    expect(useCryptoStore.getState().coins.ethereum).toEqual(eth)
  })

  it('rechaza entregar más de lo que se tiene', async () => {
    add(TransactionType.BUY, 0.1, '2026-01-01')
    await expect( swap(0.5, '2026-02-01')).rejects.toThrow(
      'No tenés suficiente BTC para intercambiar el 01/02/2026.',
    )
    expect(useCryptoStore.getState().transactions).toHaveLength(1)
  })

  it('rechaza intercambiar una moneda por sí misma', async () => {
    await expect(
      useCryptoStore.getState().addSwap({
        from: btc,
        fromQuantity: 1,
        to: btc,
        toQuantity: 1,
        valueUsd: 1,
        date: day('2026-01-01'),
      }),
    ).rejects.toThrow(/dos monedas distintas/)
  })

  it('borrar una pata borra el intercambio completo', () => {
    add(TransactionType.BUY, 1, '2026-01-01')
    swap(0.5, '2026-02-01')
    const buyLeg = useCryptoStore.getState().transactions[2]
    useCryptoStore.getState().removeTransaction(buyLeg.id)
    expect(useCryptoStore.getState().transactions).toHaveLength(1)
  })

  it('no deja borrar un intercambio si la moneda recibida ya se vendió', async () => {
    add(TransactionType.BUY, 1, '2026-01-01')
    swap(0.5, '2026-02-01')
    useCryptoStore.getState().addTransaction(
      { coinId: 'ethereum', type: TransactionType.SELL, quantity: 10, priceUsd: 3_000, date: day('2026-03-01') },
      eth,
    )
    const sellLeg = useCryptoStore.getState().transactions[1]
    await expect( useCryptoStore.getState().removeTransaction(sellLeg.id)).rejects.toThrow(
      /la venta de ETH del 01\/03\/2026/,
    )
    expect(useCryptoStore.getState().transactions).toHaveLength(4)
  })

  it('las patas de un intercambio no se editan', async () => {
    add(TransactionType.BUY, 1, '2026-01-01')
    swap(0.5, '2026-02-01')
    const sellLeg = useCryptoStore.getState().transactions[1]
    await expect(
      useCryptoStore.getState().updateTransaction(sellLeg.id, { ...sellLeg, quantity: 0.1 }, btc),
    ).rejects.toThrow(/no se editan/)
  })
})

describe('migrateCryptoStorage', () => {
  it('v1 → v2 conserva operaciones y monedas', () => {
    // Snapshot con la forma real de `crypto-storage` v1 (fechas ya serializadas)
    const v1 = {
      transactions: [
        { id: 'a', coinId: 'bitcoin', type: 'BUY', quantity: 0.5, priceUsd: 60_000, date: '2026-09-01T03:00:00.000Z' },
      ],
      coins: { bitcoin: btc },
    }
    expect(migrateCryptoStorage(v1)).toEqual(v1)
  })

  it('estado vacío o ausente', () => {
    expect(migrateCryptoStorage(undefined)).toEqual({ transactions: [], coins: {} })
  })
})
