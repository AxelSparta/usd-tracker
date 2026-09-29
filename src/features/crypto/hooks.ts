'use client'

import { useEffect, useMemo } from 'react'
import { computeCryptoPositions, summarizePortfolio } from './metrics'
import { useCryptoStore } from './crypto.store'
import { useCryptoPricesStore } from './prices.store'

const REFRESH_MS = 60 * 1000

/** Ids de las monedas con operaciones, en orden estable */
const useHeldCoinIds = () => {
  const transactions = useCryptoStore((s) => s.transactions)
  const key = useMemo(
    () => [...new Set(transactions.map((tx) => tx.coinId))].sort().join(','),
    [transactions],
  )
  return useMemo(() => (key ? key.split(',') : []), [key])
}

/** Trae los precios de las monedas en cartera y los refresca cada minuto. */
export const useCryptoPriceSync = () => {
  const ids = useHeldCoinIds()
  const fetchPrices = useCryptoPricesStore((s) => s.fetchPrices)

  useEffect(() => {
    if (ids.length === 0) return
    fetchPrices(ids)
    const interval = setInterval(() => fetchPrices(ids), REFRESH_MS)
    return () => clearInterval(interval)
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
