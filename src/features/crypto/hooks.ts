'use client'

import { useEffect, useMemo } from 'react'
import { computeCryptoPositions, summarizePortfolio } from './metrics'
import { useCryptoStore } from './crypto.store'
import { useCryptoPricesStore } from './prices.store'
import { priceRefreshDelay } from './refresh'

/** Ids de las monedas con operaciones (más `extra`), en orden estable */
const useHeldCoinIds = (extra: string[]) => {
  const transactions = useCryptoStore((s) => s.transactions)
  const key = useMemo(
    () => [...new Set([...transactions.map((tx) => tx.coinId), ...extra])].sort().join(','),
    [transactions, extra],
  )
  return useMemo(() => (key ? key.split(',') : []), [key])
}

const NONE: string[] = []

/**
 * Trae los precios de las monedas en cartera y los refresca cada minuto;
 * si la API falla (p. ej. 429), espacia los reintentos con backoff exponencial.
 * `extra`: monedas de otros portafolios (vista "Todos" del dashboard).
 */
export const useCryptoPriceSync = (extra: string[] = NONE) => {
  const ids = useHeldCoinIds(extra)
  const fetchPrices = useCryptoPricesStore((s) => s.fetchPrices)

  useEffect(() => {
    if (ids.length === 0) return
    let cancelled = false
    let timeout: ReturnType<typeof setTimeout> | undefined
    let failures = 0

    const tick = async () => {
      const ok = await fetchPrices(ids)
      if (cancelled) return
      failures = ok ? 0 : failures + 1
      timeout = setTimeout(tick, priceRefreshDelay(failures))
    }
    tick()

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [ids, fetchPrices])
}

/** Posiciones y resumen derivados (no se persisten: se recalculan con cada precio). */
export const useCryptoPortfolio = () => {
  const transactions = useCryptoStore((s) => s.transactions)
  const coins = useCryptoStore((s) => s.coins)
  const prices = useCryptoPricesStore((s) => s.prices)

  return useMemo(() => {
    const positions = computeCryptoPositions(transactions, coins, prices)
    return { positions, summary: summarizePortfolio(positions) }
  }, [transactions, coins, prices])
}
