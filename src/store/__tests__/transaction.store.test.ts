import { beforeEach, describe, expect, it } from 'vitest'
import {
  migrateTransactionsStorage,
  useTransactionStore,
} from '@/store/transaction.store'
import { DolarOption } from '@/types/dolar.types'
import { TransactionType } from '@/types/transaction.types'

// Forma real de `transactions-storage` antes de v1 (JSON.parse de localStorage)
const v0Snapshot = {
  state: {
    transactions: {
      blue: [
        {
          id: 'a',
          type: 'BUY',
          pesosAmount: 100000,
          dollarsAmount: 100,
          date: '2026-01-10T03:00:00.000Z',
          dolarOption: 'blue',
        },
      ],
    },
    transactionsData: {
      blue: {
        totalUsd: 100,
        investedPesos: 100000,
        marketValuePesos: 120000,
        averageCost: 1000,
        realizedProfit: 0,
        unrealizedProfit: 20000,
      },
    },
  },
  version: 0,
}

describe('migrateTransactionsStorage', () => {
  it('v0 → v1 conserva las transacciones y descarta las métricas persistidas', () => {
    const migrated = migrateTransactionsStorage(v0Snapshot.state, 0)
    expect(migrated).toEqual({ transactions: v0Snapshot.state.transactions })
    expect(migrated).not.toHaveProperty('transactionsData')
  })

  it('tolera estado vacío', () => {
    expect(migrateTransactionsStorage(undefined, 0)).toEqual({ transactions: {} })
  })

  it('v1 → v2 conserva las transacciones (usdtSwapId es opcional)', () => {
    // Snapshot con la forma real de `transactions-storage` v1 (fechas ya serializadas)
    const v1 = {
      transactions: {
        cripto: [
          {
            id: '6f1c3a52-6a0e-4a52-9a43-5d4b0f6f0d11',
            type: 'BUY',
            pesosAmount: 1_450_000,
            dollarsAmount: 1000,
            date: '2026-09-15T03:00:00.000Z',
            dolarOption: 'cripto',
          },
        ],
      },
    }
    expect(migrateTransactionsStorage(v1, 1)).toEqual(v1)
  })

  it('v2 → v3 conserva los intercambios USDT (kind y note son opcionales)', () => {
    const v2 = {
      transactions: {
        cripto: [
          { id: 'a', type: 'BUY', pesosAmount: 1_450_000, dollarsAmount: 1000, date: '2026-09-15T03:00:00.000Z', dolarOption: 'cripto' },
          { id: 'b', type: 'SELL', pesosAmount: 900_000, dollarsAmount: 600, date: '2026-09-20T03:00:00.000Z', dolarOption: 'cripto', usdtSwapId: 'u' },
        ],
      },
    }
    expect(migrateTransactionsStorage(v2, 2)).toEqual(v2)
  })
})

const day = (iso: string) => new Date(`${iso}T00:00:00`)
const base = {
  pesosAmount: 100_000,
  dollarsAmount: 100,
  dolarOption: DolarOption.Blue,
}

describe('updateTransaction', () => {
  // `ready`: sin esto las acciones esperan a que se resuelva la sesión (`whenReady`)
  beforeEach(() => useTransactionStore.setState({ transactions: {}, status: 'ready' }))

  const add = (type: TransactionType, iso: string, extra = {}) =>
    useTransactionStore
      .getState()
      .addTransaction({ ...base, type, date: day(iso), ...extra })
  const txsOf = (option: DolarOption) =>
    useTransactionStore.getState().transactions[option] ?? []

  it('edita montos y reordena por fecha', async () => {
    await add(TransactionType.BUY, '2026-01-01')
    await add(TransactionType.BUY, '2026-02-01')
    const [first] = txsOf(DolarOption.Blue)

    useTransactionStore.getState().updateTransaction(first.id, {
      ...base,
      type: TransactionType.BUY,
      pesosAmount: 150_000,
      date: day('2026-03-01'),
    })

    const group = txsOf(DolarOption.Blue)
    expect(group.map((t) => t.id).at(-1)).toBe(first.id)
    expect(group.at(-1)?.pesosAmount).toBe(150_000)
  })

  it('mueve la transacción de grupo si cambia el tipo de dólar', async () => {
    await add(TransactionType.BUY, '2026-01-01')
    const [tx] = txsOf(DolarOption.Blue)

    useTransactionStore.getState().updateTransaction(tx.id, {
      ...base,
      type: TransactionType.BUY,
      date: day('2026-01-01'),
      dolarOption: DolarOption.Oficial,
    })

    expect(txsOf(DolarOption.Blue)).toHaveLength(0)
    expect(txsOf(DolarOption.Oficial)[0].id).toBe(tx.id)
  })

  it('rechaza una edición que deja una venta sin saldo y no modifica nada', async () => {
    await add(TransactionType.BUY, '2026-01-01')
    await add(TransactionType.SELL, '2026-02-01')
    const before = txsOf(DolarOption.Blue)
    const buy = before.find((t) => t.type === TransactionType.BUY)!

    await expect(
      useTransactionStore.getState().updateTransaction(buy.id, {
        ...base,
        type: TransactionType.BUY,
        dollarsAmount: 50,
        date: day('2026-01-01'),
      }),
    ).rejects.toThrow(/saldo de USD quedaría negativo/)
    expect(txsOf(DolarOption.Blue)).toEqual(before)
  })

  it('rechaza mover a otro tipo de dólar una compra que respalda una venta', async () => {
    await add(TransactionType.BUY, '2026-01-01')
    await add(TransactionType.SELL, '2026-02-01')
    const buy = txsOf(DolarOption.Blue).find((t) => t.type === TransactionType.BUY)!

    await expect(
      useTransactionStore.getState().updateTransaction(buy.id, {
        ...base,
        type: TransactionType.BUY,
        date: day('2026-01-01'),
        dolarOption: DolarOption.Oficial,
      }),
    ).rejects.toThrow(/saldo de USD quedaría negativo/)
  })
})
