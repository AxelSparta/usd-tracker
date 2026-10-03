import { describe, expect, it } from 'vitest'
import {
  applyRemoveTransaction,
  applyUpdateTransaction,
  USDT_SWAP_LEG_REMOVE,
  USDT_SWAP_LEG_UPDATE,
} from '@/domain/transactions'
import { computePosition } from '@/domain/position'
import { computeCryptoPositions } from '@/features/crypto/metrics'
import {
  applyRemoveCryptoTransaction,
  applyUpdateCryptoTransaction,
} from '@/features/crypto/operations'
import type { Coin } from '@/features/crypto/types'
import {
  applyAddUsdtSwap,
  applyRemoveUsdtSwap,
  assertUsdtSwapsComplete,
  buildUsdtSwapLegs,
  type LinkedState,
  type UsdtSwapInput,
} from '@/features/usdt-swaps/operations'
import { DolarOption } from '@/types/dolar.types'
import { TransactionType, type Transaction } from '@/types/transaction.types'

const btc: Coin = { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', image: null }
const ids = { usdtSwapId: 'swap', dolarId: 'usdt-leg', cryptoId: 'coin-leg' }
const day = (d: number) => new Date(`2026-02-${String(d).padStart(2, '0')}T12:00:00`)

/** 1.000 USDT comprados a $1.400 el 1/2 */
const usdtBuy: Transaction = {
  id: 'usdt-buy',
  type: TransactionType.BUY,
  dollarsAmount: 1000,
  pesosAmount: 1_400_000,
  date: day(1),
  dolarOption: DolarOption.Cripto,
}

const funded: LinkedState = {
  dolar: { [DolarOption.Cripto]: [usdtBuy] },
  crypto: { transactions: [], coins: {} },
}

const toBtc: UsdtSwapInput = {
  direction: 'USDT_TO_COIN',
  coin: btc,
  quantity: 0.01,
  usdt: 600,
  arsRate: 1500,
  date: day(5),
}

describe('buildUsdtSwapLegs', () => {
  it('USDT → cripto: vende USDT del dólar cripto y compra la moneda a USDT / cantidad', () => {
    const [usdt, coin] = buildUsdtSwapLegs(toBtc, ids)
    expect(usdt).toMatchObject({
      id: 'usdt-leg',
      type: 'SELL',
      dollarsAmount: 600,
      pesosAmount: 900_000,
      dolarOption: 'cripto',
      usdtSwapId: 'swap',
    })
    expect(coin).toMatchObject({
      id: 'coin-leg',
      coinId: 'bitcoin',
      type: 'BUY',
      quantity: 0.01,
      priceUsd: 60_000,
      usdtSwapId: 'swap',
    })
    expect(coin.fee).toBeUndefined()
  })

  it('comisión en USDT: entregar cuesta USDT + comisión y el costo de la moneda la incluye', () => {
    const [usdt, coin] = buildUsdtSwapLegs(
      { ...toBtc, fee: { amount: 0.6, currency: 'USDT' } },
      ids,
    )
    expect(usdt.dollarsAmount).toBeCloseTo(600.6)
    expect(coin.priceUsd * coin.quantity).toBeCloseTo(600.6)
    expect(coin.fee).toBeUndefined()
  })

  it('comisión en USDT al recibir: entran USDT − comisión', () => {
    const [usdt, coin] = buildUsdtSwapLegs(
      { ...toBtc, direction: 'COIN_TO_USDT', fee: { amount: 0.6, currency: 'USDT' } },
      ids,
    )
    expect(usdt).toMatchObject({ type: 'BUY' })
    expect(usdt.dollarsAmount).toBeCloseTo(599.4)
    expect(coin).toMatchObject({ type: 'SELL' })
    expect(coin.priceUsd * coin.quantity).toBeCloseTo(599.4)
  })

  it('comisión en la moneda: va a la pata cripto', () => {
    const [usdt, coin] = buildUsdtSwapLegs(
      { ...toBtc, fee: { amount: 0.0001, currency: 'COIN' } },
      ids,
    )
    expect(usdt.dollarsAmount).toBe(600)
    expect(coin.fee).toEqual({ amount: 0.0001, currency: 'COIN' })
  })
})

describe('applyAddUsdtSwap', () => {
  it('USDT → cripto: baja el saldo de USDT y realiza la ganancia cambiaria en ARS', () => {
    const next = applyAddUsdtSwap(funded, toBtc, ids)
    const usdtGroup = next.dolar.cripto!
    expect(usdtGroup.map((t) => t.id)).toEqual(['usdt-buy', 'usdt-leg'])

    const usdt = computePosition(
      usdtGroup.map((t) => ({ type: t.type, quantity: t.dollarsAmount, quoteAmount: t.pesosAmount })),
      { dust: 0.0001 },
    )
    expect(usdt.quantity).toBe(400)
    // 600 USDT comprados a $1.400 y entregados a $1.500
    expect(usdt.realizedProfit).toBeCloseTo(60_000)

    expect(next.crypto.coins.bitcoin).toEqual(btc)
    const [position] = computeCryptoPositions(next.crypto.transactions, next.crypto.coins, {})
    expect(position).toMatchObject({ quantity: 0.01, investedUsd: 600 })
  })

  it('cripto → USDT: los USDT entran con costo en ARS y la moneda realiza su PnL en USD', () => {
    const withBtc = applyAddUsdtSwap(funded, toBtc, ids)
    const back = applyAddUsdtSwap(
      withBtc,
      { ...toBtc, direction: 'COIN_TO_USDT', usdt: 700, arsRate: 1520, date: day(10) },
      { usdtSwapId: 'swap2', dolarId: 'usdt-leg2', cryptoId: 'coin-leg2' },
    )
    expect(back.dolar.cripto!.at(-1)).toMatchObject({
      type: 'BUY',
      dollarsAmount: 700,
      pesosAmount: 1_064_000,
    })
    const [position] = computeCryptoPositions(back.crypto.transactions, back.crypto.coins, {})
    expect(position.quantity).toBe(0)
    expect(position.realizedPnlUsd).toBeCloseTo(100)
  })

  it('rechaza si no hay suficientes USDT a esa fecha', () => {
    expect(() => applyAddUsdtSwap(funded, { ...toBtc, usdt: 1500 }, ids)).toThrow(
      'No tenés suficientes USDT el 05/02/2026.',
    )
    expect(() =>
      applyAddUsdtSwap({ ...funded, dolar: {} }, toBtc, ids),
    ).toThrow('No tenés suficientes USDT')
  })

  it('la comisión en USDT también tiene que alcanzar', () => {
    expect(() =>
      applyAddUsdtSwap(funded, { ...toBtc, usdt: 1000, fee: { amount: 1, currency: 'USDT' } }, ids),
    ).toThrow('No tenés suficientes USDT')
  })

  it('rechaza vender una moneda que no se tiene', () => {
    expect(() =>
      applyAddUsdtSwap(funded, { ...toBtc, direction: 'COIN_TO_USDT' }, ids),
    ).toThrow('No tenés suficiente BTC para intercambiar el 05/02/2026.')
  })

  it('rechaza Tether: los USDT ya son el dólar cripto', () => {
    const tether: Coin = { id: 'tether', symbol: 'USDT', name: 'Tether', image: null }
    expect(() => applyAddUsdtSwap(funded, { ...toBtc, coin: tether }, ids)).toThrow(
      'Los USDT ya son el dólar cripto',
    )
  })

  it('rechaza datos inválidos', () => {
    expect(() => applyAddUsdtSwap(funded, { ...toBtc, arsRate: 0 }, ids)).toThrow('cotización')
    expect(() =>
      applyAddUsdtSwap(
        funded,
        { ...toBtc, direction: 'COIN_TO_USDT', fee: { amount: 600, currency: 'USDT' } },
        ids,
      ),
    ).toThrow('La comisión no puede ser mayor')
  })
})

describe('applyRemoveUsdtSwap', () => {
  it('quita las dos patas', () => {
    const result = applyRemoveUsdtSwap(applyAddUsdtSwap(funded, toBtc, ids), 'swap')
    expect(result?.removedIds.sort()).toEqual(['coin-leg', 'usdt-leg'])
    expect(result?.state.dolar.cripto!.map((t) => t.id)).toEqual(['usdt-buy'])
    expect(result?.state.crypto.transactions).toEqual([])
  })

  it('null si no existe', () => {
    expect(applyRemoveUsdtSwap(funded, 'nope')).toBeNull()
  })

  it('rechaza si lo recibido ya se vendió después', () => {
    const withBtc = applyAddUsdtSwap(funded, toBtc, ids)
    const sold = {
      ...withBtc,
      crypto: {
        ...withBtc.crypto,
        transactions: [
          ...withBtc.crypto.transactions,
          {
            id: 'btc-sell',
            coinId: 'bitcoin',
            type: TransactionType.SELL,
            quantity: 0.01,
            priceUsd: 70_000,
            date: day(8),
          },
        ],
      },
    }
    expect(() => applyRemoveUsdtSwap(sold, 'swap')).toThrow(
      'No se puede eliminar: la venta de BTC del 08/02/2026 quedaría sin saldo.',
    )
  })

  it('rechaza si los USDT recibidos ya se vendieron', () => {
    const empty: LinkedState = {
      dolar: {},
      crypto: {
        transactions: [
          { id: 'b', coinId: 'bitcoin', type: TransactionType.BUY, quantity: 1, priceUsd: 50_000, date: day(1) },
        ],
        coins: { bitcoin: btc },
      },
    }
    const withUsdt = applyAddUsdtSwap(empty, { ...toBtc, direction: 'COIN_TO_USDT' }, ids)
    const spent: LinkedState = {
      ...withUsdt,
      dolar: {
        cripto: [
          ...withUsdt.dolar.cripto!,
          { ...usdtBuy, id: 'usdt-sell', type: TransactionType.SELL, dollarsAmount: 600, date: day(9) },
        ],
      },
    }
    expect(() => applyRemoveUsdtSwap(spent, 'swap')).toThrow(
      'No se puede eliminar: la venta de USDT del 09/02/2026 quedaría sin saldo.',
    )
  })
})

describe('patas sueltas', () => {
  const linked = applyAddUsdtSwap(funded, toBtc, ids)

  it('el módulo dólar no edita ni borra una pata sola', () => {
    expect(() => applyRemoveTransaction(linked.dolar, 'usdt-leg')).toThrow(USDT_SWAP_LEG_REMOVE)
    expect(() =>
      applyUpdateTransaction(linked.dolar, 'usdt-leg', { ...linked.dolar.cripto![1] }),
    ).toThrow(USDT_SWAP_LEG_UPDATE)
  })

  it('el módulo cripto no edita ni borra una pata sola', () => {
    expect(() => applyRemoveCryptoTransaction(linked.crypto, 'coin-leg')).toThrow(
      USDT_SWAP_LEG_REMOVE,
    )
    expect(() =>
      applyUpdateCryptoTransaction(linked.crypto, 'coin-leg', linked.crypto.transactions[0], btc),
    ).toThrow(USDT_SWAP_LEG_UPDATE)
  })

  it('las demás operaciones se siguen editando y borrando', () => {
    expect(applyRemoveTransaction(funded.dolar, 'usdt-buy')).toEqual({ cripto: [] })
  })
})

describe('assertUsdtSwapsComplete', () => {
  const [usdtLeg, coinLeg] = buildUsdtSwapLegs(toBtc, ids)

  it('acepta intercambios con sus dos patas y operaciones normales', () => {
    expect(() => assertUsdtSwapsComplete([usdtBuy, usdtLeg], [coinLeg])).not.toThrow()
  })

  it('rechaza una pata sin la otra', () => {
    expect(() => assertUsdtSwapsComplete([usdtLeg], [])).toThrow('incompleto')
    expect(() => assertUsdtSwapsComplete([], [coinLeg])).toThrow('incompleto')
    expect(() => assertUsdtSwapsComplete([usdtLeg, { ...usdtLeg, id: 'x' }], [coinLeg])).toThrow(
      'incompleto',
    )
  })

  it('rechaza una pata del dólar fuera del dólar cripto', () => {
    expect(() =>
      assertUsdtSwapsComplete([{ ...usdtLeg, dolarOption: DolarOption.Blue }], [coinLeg]),
    ).toThrow('dólar cripto')
  })
})
