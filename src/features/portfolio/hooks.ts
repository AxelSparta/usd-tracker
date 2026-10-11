'use client'

import { subDays } from 'date-fns'
import { useEffect, useMemo } from 'react'
import { useCedearsStore } from '@/features/cedears/cedears.store'
import { useCedearPortfolio } from '@/features/cedears/hooks'
import { useCedearPricesStore } from '@/features/cedears/prices.store'
import { useCryptoStore } from '@/features/crypto/crypto.store'
import { useCryptoPortfolio } from '@/features/crypto/hooks'
import { useCryptoPricesStore } from '@/features/crypto/prices.store'
import { computePesosBalance } from '@/features/pesos/operations'
import { usePesosStore } from '@/features/pesos/pesos.store'
import type { SyncStatus } from '@/lib/synced-store'
import { useDolarStore } from '@/store/dolar.store'
import { useTransactionStore, useTransactionsData } from '@/store/transaction.store'
import { DolarOption } from '@/types/dolar.types'
import { computeValueHistory, toDateKey, trimLeadingGaps } from './history'
import { historyKey, useHistoryStore } from './history.store'
import { computePortfolioOverview } from './overview'

/** Peor estado de los stores: error > cargando > listo */
const combine = (...statuses: SyncStatus[]): SyncStatus =>
  statuses.includes('error')
    ? 'error'
    : statuses.every((s) => s === 'ready')
      ? 'ready'
      : 'loading'

/** Vista unificada de los módulos (derivada, no se persiste) */
export const usePortfolioOverview = () => {
  const dolarData = useTransactionsData()
  const dolarTransactions = useTransactionStore((s) => s.transactions)
  const dolarStatus = useTransactionStore((s) => s.status)
  const cryptoStatus = useCryptoStore((s) => s.status)
  const cryptoCount = useCryptoStore((s) => s.transactions.length)
  const pesosStatus = usePesosStore((s) => s.status)
  const pesosMovements = usePesosStore((s) => s.movements)
  const cedearsStatus = useCedearsStore((s) => s.status)
  const cedearCount = useCedearsStore((s) => s.transactions.length)
  const { positions: cedearPositions } = useCedearPortfolio()
  const { positions } = useCryptoPortfolio()
  const allDolarData = useDolarStore((s) => s.allDolarData)

  const cryptoArsRate = allDolarData?.[DolarOption.Cripto]
    ? Number(allDolarData[DolarOption.Cripto].compra) || null
    : null
  // Lo que cuesta pasar los pesos a dólares: MEP venta (D3)
  const mepRate = allDolarData?.[DolarOption.Bolsa]
    ? Number(allDolarData[DolarOption.Bolsa].venta) || null
    : null
  const pesosBalance = useMemo(() => computePesosBalance(pesosMovements), [pesosMovements])

  const overview = useMemo(
    () =>
      computePortfolioOverview({
        dolarData,
        // DolarAPI trae el nombre largo ("Contado con liquidación"); sin cotizaciones, el id
        dolarLabel: (option) => `Dólar ${allDolarData?.[option]?.nombre ?? option}`,
        cryptoPositions: positions,
        cryptoArsRate,
        pesosBalance,
        mepRate,
        cedearPositions,
      }),
    [dolarData, allDolarData, positions, cryptoArsRate, pesosBalance, mepRate, cedearPositions],
  )

  const hasPesos = pesosMovements.length > 0
  const hasCedears = cedearCount > 0
  const hasOperations =
    cryptoCount > 0 ||
    hasPesos ||
    hasCedears ||
    Object.values(dolarTransactions).some((g) => g && g.length > 0)

  const retry = () => {
    for (const store of [useTransactionStore, useCryptoStore, usePesosStore, useCedearsStore]) {
      if (store.getState().status === 'error') void store.getState().retryCloud()
    }
  }

  return {
    overview,
    cryptoArsRate,
    mepRate,
    pesosBalance,
    hasOperations,
    hasPesos,
    hasCedears,
    status: combine(dolarStatus, cryptoStatus, pesosStatus, cedearsStatus),
    retry,
  }
}

export type HistoryRange = '1M' | '3M' | '6M' | '1A'
export type HistoryCurrency = 'ars' | 'usd'

const RANGE_DAYS: Record<HistoryRange, number> = { '1M': 30, '3M': 91, '6M': 182, '1A': 364 }

/**
 * Serie diaria del valor del portfolio en la moneda elegida, reconstruida desde las
 * transacciones y los precios históricos (ver `history.ts`). Arranca en el primer día
 * con operaciones dentro del rango, y recorta los días iniciales sin precio.
 */
export const useValueHistory = (range: HistoryRange, currency: HistoryCurrency) => {
  const dolarGroups = useTransactionStore((s) => s.transactions)
  const cryptoTxs = useCryptoStore((s) => s.transactions)
  const pesosMovements = usePesosStore((s) => s.movements)
  const cedearTxs = useCedearsStore((s) => s.transactions)

  const dolarTxs = useMemo(
    () => Object.values(dolarGroups).flatMap((g) => g ?? []),
    [dolarGroups],
  )
  const casas = useMemo(() => {
    const set = new Set<string>(dolarTxs.map((t) => t.dolarOption))
    // Cripto a pesos usa el dólar cripto
    if (cryptoTxs.length > 0) set.add(DolarOption.Cripto)
    // Pesos a dólares usa el MEP
    if (pesosMovements.length > 0) set.add(DolarOption.Bolsa)
    // CEDEARs a dólares usa el CCL
    if (cedearTxs.length > 0) set.add(DolarOption.ContadoConLiqui)
    return [...set].sort()
  }, [dolarTxs, cryptoTxs, pesosMovements, cedearTxs])
  const ids = useMemo(() => [...new Set(cryptoTxs.map((t) => t.coinId))].sort(), [cryptoTxs])
  const tickers = useMemo(() => [...new Set(cedearTxs.map((t) => t.ticker))].sort(), [cedearTxs])

  const allDolarData = useDolarStore((s) => s.allDolarData)
  const livePrices = useCryptoPricesStore((s) => s.prices)
  const liveCedearPrices = useCedearPricesStore((s) => s.prices)

  const key = historyKey(casas, ids, tickers)
  const entry = useHistoryStore((s) => s.entries[key])
  const load = useHistoryStore((s) => s.load)
  const hasTxs = dolarTxs.length + cryptoTxs.length + pesosMovements.length + cedearTxs.length > 0

  useEffect(() => {
    if (hasTxs) load(casas, ids, tickers)
  }, [hasTxs, casas, ids, tickers, load])

  const result = useMemo(() => {
    if (entry?.status !== 'ready') return { points: [], gapUntil: null }
    const to = toDateKey(new Date())
    const rangeStart = toDateKey(subDays(new Date(), RANGE_DAYS[range]))
    const firstTx = [...dolarTxs, ...cryptoTxs, ...pesosMovements, ...cedearTxs]
      .map((t) => toDateKey(t.date))
      .reduce((min, d) => (d < min ? d : min), to)
    const from = firstTx > rangeStart ? firstTx : rangeStart

    // Hoy se valúa con los precios en vivo (los mismos del resumen de arriba): así la
    // serie termina en el valor total. Además CoinGecko fecha en UTC y su punto "actual"
    // puede caer en mañana para la hora argentina.
    const withToday = <T extends { date: string }>(series: T[] | undefined, today: T | null) =>
      today ? [...(series ?? []).filter((p) => p.date < to), today] : series
    const dolarPrices = Object.fromEntries(
      casas.map((casa) => {
        const live = allDolarData?.[casa as DolarOption]
        return [
          casa,
          withToday(
            entry.data.dolar[casa as DolarOption],
            live ? { date: to, buy: Number(live.compra), sell: Number(live.venta) } : null,
          ),
        ]
      }),
    )
    const coinPrices = Object.fromEntries(
      ids.map((id) => [
        id,
        withToday(entry.data.coins[id], livePrices[id] ? { date: to, usd: livePrices[id].usd } : null) ?? [],
      ]),
    )
    const cedearPrices = Object.fromEntries(
      tickers.map((ticker) => {
        const live = liveCedearPrices[ticker]?.priceArs
        return [
          ticker,
          withToday(entry.data.cedears[ticker], live ? { date: to, ars: live } : null) ?? [],
        ]
      }),
    )

    const points = computeValueHistory({
      dolarTxs,
      cryptoTxs,
      pesosMovements,
      cedearTxs,
      cedearPrices,
      dolarPrices,
      coinPrices,
      from,
      to,
    })
    return trimLeadingGaps(points, currency)
  }, [
    entry,
    range,
    currency,
    dolarTxs,
    cryptoTxs,
    pesosMovements,
    cedearTxs,
    casas,
    ids,
    tickers,
    allDolarData,
    livePrices,
    liveCedearPrices,
  ])

  return {
    ...result,
    status: !hasTxs ? ('ready' as const) : (entry?.status ?? 'loading'),
    error: entry?.status === 'error' ? entry.message : null,
    retry: () => load(casas, ids, tickers, true),
    /** El histórico de CEDEARs (data912) no está ajustado por ratio y falta para algunos tickers */
    hasCedears: cedearTxs.length > 0,
  }
}
