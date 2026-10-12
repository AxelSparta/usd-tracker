'use client'

import { subDays } from 'date-fns'
import { useEffect, useMemo } from 'react'
import { computeTransactionsData } from '@/domain/metrics'
import { groupTransactions } from '@/domain/transactions'
import { useCedearsStore } from '@/features/cedears/cedears.store'
import { useCclSell } from '@/features/cedears/hooks'
import { computeCedearPositions } from '@/features/cedears/metrics'
import { useCedearPricesStore } from '@/features/cedears/prices.store'
import { useCryptoStore } from '@/features/crypto/crypto.store'
import { computeCryptoPositions } from '@/features/crypto/metrics'
import { useCryptoPricesStore } from '@/features/crypto/prices.store'
import { computePesosBalance } from '@/features/pesos/operations'
import { usePesosStore } from '@/features/pesos/pesos.store'
import type { PortfolioData } from '@/features/portfolios/data-stores'
import { otherKey, usePortfolios, usePortfoliosStore } from '@/features/portfolios/portfolios.store'
import type { SyncStatus } from '@/lib/synced-store'
import { selectMarketPrices, useDolarStore } from '@/store/dolar.store'
import { useTransactionStore } from '@/store/transaction.store'
import { DolarOption } from '@/types/dolar.types'
import { computeValueHistory, toDateKey, trimLeadingGaps } from './history'
import { historyKey, useHistoryStore } from './history.store'
import { combinePortfolioOverviews, computePortfolioOverview } from './overview'

/** Peor estado: error > cargando > listo */
const combine = (...statuses: SyncStatus[]): SyncStatus =>
  statuses.includes('error')
    ? 'error'
    : statuses.every((s) => s === 'ready')
      ? 'ready'
      : 'loading'

/**
 * Portafolios que muestra el dashboard: el activo (de los stores) y, en la vista "Todos", el resto
 * (`usePortfoliosStore.others`, cargados a pedido). Cada uno por separado: se suman al final.
 */
export const useDashboardPortfolios = () => {
  const dolarGroups = useTransactionStore((s) => s.transactions)
  const cryptoTransactions = useCryptoStore((s) => s.transactions)
  const coins = useCryptoStore((s) => s.coins)
  const pesosMovements = usePesosStore((s) => s.movements)
  const cedearTxs = useCedearsStore((s) => s.transactions)
  const dolarStatus = useTransactionStore((s) => s.status)
  const cryptoStatus = useCryptoStore((s) => s.status)
  const pesosStatus = usePesosStore((s) => s.status)
  const cedearsStatus = useCedearsStore((s) => s.status)

  const { portfolios, active, source } = usePortfolios()
  const showAll = usePortfoliosStore((s) => s.showAll) && portfolios.length > 1
  const others = usePortfoliosStore((s) => s.others)
  const loadOthers = usePortfoliosStore((s) => s.loadOthers)

  useEffect(() => {
    if (showAll) loadOthers()
  }, [showAll, portfolios, active, loadOthers])

  const activeData = useMemo(
    (): PortfolioData => ({
      dolar: Object.values(dolarGroups).flatMap((g) => g ?? []),
      crypto: { transactions: cryptoTransactions, coins },
      pesos: pesosMovements,
      cedears: cedearTxs,
    }),
    [dolarGroups, cryptoTransactions, coins, pesosMovements, cedearTxs],
  )

  const otherEntries = useMemo(
    () =>
      showAll
        ? portfolios
            .filter((p) => p.id !== active?.id)
            .map((p) => others[otherKey(source, p.id)] ?? { status: 'loading' as const })
        : [],
    [showAll, portfolios, active, others, source],
  )

  const sets = useMemo(
    () => [
      activeData,
      ...otherEntries.flatMap((entry) => (entry.status === 'ready' ? [entry.data] : [])),
    ],
    [activeData, otherEntries],
  )

  const othersStatus: SyncStatus = otherEntries.some((e) => e.status === 'error')
    ? 'error'
    : otherEntries.some((e) => e.status === 'loading')
      ? 'loading'
      : 'ready'

  const retry = () => {
    for (const store of [useTransactionStore, useCryptoStore, usePesosStore, useCedearsStore]) {
      if (store.getState().status === 'error') void store.getState().retryCloud()
    }
    if (othersStatus === 'error') {
      usePortfoliosStore.getState().invalidateOthers()
      usePortfoliosStore.getState().loadOthers()
    }
  }

  return {
    sets,
    showAll,
    status: combine(dolarStatus, cryptoStatus, pesosStatus, cedearsStatus, othersStatus),
    retry,
  }
}

/** Monedas y tickers de los portafolios no activos (para traer sus precios en la vista "Todos") */
export const useOtherHeldAssets = (sets: PortfolioData[]) =>
  useMemo(() => {
    const rest = sets.slice(1)
    return {
      coinIds: [...new Set(rest.flatMap((d) => d.crypto.transactions.map((t) => t.coinId)))],
      tickers: [...new Set(rest.flatMap((d) => d.cedears.map((t) => t.ticker)))],
    }
  }, [sets])

/** Vista unificada de los módulos (derivada, no se persiste) */
export const usePortfolioOverview = (sets: PortfolioData[]) => {
  const allDolarData = useDolarStore((s) => s.allDolarData)
  const coinPrices = useCryptoPricesStore((s) => s.prices)
  const cedearPrices = useCedearPricesStore((s) => s.prices)
  const cclSell = useCclSell()

  const cryptoArsRate = allDolarData?.[DolarOption.Cripto]
    ? Number(allDolarData[DolarOption.Cripto].compra) || null
    : null
  // Lo que cuesta pasar los pesos a dólares: MEP venta (D3)
  const mepRate = allDolarData?.[DolarOption.Bolsa]
    ? Number(allDolarData[DolarOption.Bolsa].venta) || null
    : null

  const overview = useMemo(() => {
    const marketPrices = selectMarketPrices({ allDolarData })
    return combinePortfolioOverviews(
      sets.map((data) =>
        computePortfolioOverview({
          dolarData: computeTransactionsData(groupTransactions(data.dolar), marketPrices),
          // DolarAPI trae el nombre largo ("Contado con liquidación"); sin cotizaciones, el id
          dolarLabel: (option) => `Dólar ${allDolarData?.[option]?.nombre ?? option}`,
          cryptoPositions: computeCryptoPositions(
            data.crypto.transactions,
            data.crypto.coins,
            coinPrices,
          ),
          cryptoArsRate,
          pesosBalance: computePesosBalance(data.pesos),
          mepRate,
          cedearPositions: computeCedearPositions(data.cedears, cedearPrices, cclSell),
        }),
      ),
    )
  }, [sets, allDolarData, coinPrices, cedearPrices, cclSell, cryptoArsRate, mepRate])

  const pesosBalance = useMemo(
    () => sets.reduce((sum, data) => sum + computePesosBalance(data.pesos), 0),
    [sets],
  )
  const hasPesos = sets.some((d) => d.pesos.length > 0)
  const hasCedears = sets.some((d) => d.cedears.length > 0)
  const hasOperations =
    hasPesos ||
    hasCedears ||
    sets.some((d) => d.dolar.length > 0 || d.crypto.transactions.length > 0)

  return { overview, cryptoArsRate, mepRate, pesosBalance, hasOperations, hasPesos, hasCedears }
}

export type HistoryRange = '1M' | '3M' | '6M' | '1A'
export type HistoryCurrency = 'ars' | 'usd'

const RANGE_DAYS: Record<HistoryRange, number> = { '1M': 30, '3M': 91, '6M': 182, '1A': 364 }

/**
 * Serie diaria del valor del portfolio en la moneda elegida, reconstruida desde las
 * transacciones y los precios históricos (ver `history.ts`). Arranca en el primer día
 * con operaciones dentro del rango, y recorta los días iniciales sin precio.
 */
export const useValueHistory = (
  sets: PortfolioData[],
  range: HistoryRange,
  currency: HistoryCurrency,
) => {
  // Con varios portafolios se suman las tenencias: el valor de un día es aditivo
  const { dolarTxs, cryptoTxs, pesosMovements, cedearTxs } = useMemo(
    () => ({
      dolarTxs: sets.flatMap((d) => d.dolar),
      cryptoTxs: sets.flatMap((d) => d.crypto.transactions),
      pesosMovements: sets.flatMap((d) => d.pesos),
      cedearTxs: sets.flatMap((d) => d.cedears),
    }),
    [sets],
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
