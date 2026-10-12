'use client'

import { useEffect, useMemo } from 'react'
import { useDolarStore } from '@/store/dolar.store'
import { DolarOption } from '@/types/dolar.types'
import { useCedearsStore } from './cedears.store'
import { computeCedearPositions, summarizeCedears } from './metrics'
import { useCedearPricesStore } from './prices.store'
import { priceRefreshDelay } from './refresh'

/** Tickers con operaciones (más `extra`), en orden estable */
const useHeldTickers = (extra: string[]) => {
  const transactions = useCedearsStore((s) => s.transactions)
  const key = useMemo(
    () => [...new Set([...transactions.map((tx) => tx.ticker), ...extra])].sort().join(','),
    [transactions, extra],
  )
  return useMemo(() => (key ? key.split(',') : []), [key])
}

const NONE: string[] = []

/**
 * Trae los precios de los CEDEARs en cartera y los refresca cada 5 min mientras la sección está
 * montada; si data912 falla, espacia los reintentos con backoff.
 * `extra`: tickers de otros portafolios (vista "Todos" del dashboard).
 */
export const useCedearPriceSync = (extra: string[] = NONE) => {
  const tickers = useHeldTickers(extra)
  const fetchPrices = useCedearPricesStore((s) => s.fetchPrices)

  useEffect(() => {
    if (tickers.length === 0) return
    let cancelled = false
    let timeout: ReturnType<typeof setTimeout> | undefined
    let failures = 0

    const tick = async () => {
      const ok = await fetchPrices(tickers)
      if (cancelled) return
      failures = ok ? 0 : failures + 1
      timeout = setTimeout(tick, priceRefreshDelay(failures))
    }
    tick()

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [tickers, fetchPrices])
}

/** CCL venta de DolarAPI: pasa el valor ARS a USD (D5); `null` mientras no llega */
export const useCclSell = () => {
  const ccl = useDolarStore((s) => s.allDolarData?.[DolarOption.ContadoConLiqui])
  return ccl ? Number(ccl.venta) : null
}

/** Posiciones y resumen derivados (no se persisten: se recalculan con cada precio). */
export const useCedearPortfolio = () => {
  const transactions = useCedearsStore((s) => s.transactions)
  const prices = useCedearPricesStore((s) => s.prices)
  const cclSell = useCclSell()

  return useMemo(() => {
    const positions = computeCedearPositions(transactions, prices, cclSell)
    return { positions, summary: summarizeCedears(positions), cclSell }
  }, [transactions, prices, cclSell])
}
