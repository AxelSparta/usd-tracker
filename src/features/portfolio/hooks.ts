'use client'

import { useMemo } from 'react'
import { useCryptoStore } from '@/features/crypto/crypto.store'
import { useCryptoPortfolio } from '@/features/crypto/hooks'
import type { SyncStatus } from '@/lib/synced-store'
import { useDolarStore } from '@/store/dolar.store'
import { useTransactionStore, useTransactionsData } from '@/store/transaction.store'
import { DolarOption } from '@/types/dolar.types'
import { computePortfolioOverview } from './overview'

/** Peor estado de los dos stores: error > cargando > listo */
const combine = (a: SyncStatus, b: SyncStatus): SyncStatus =>
  a === 'error' || b === 'error'
    ? 'error'
    : a === 'ready' && b === 'ready'
      ? 'ready'
      : 'loading'

/** Vista unificada de los dos módulos (derivada, no se persiste) */
export const usePortfolioOverview = () => {
  const dolarData = useTransactionsData()
  const dolarTransactions = useTransactionStore((s) => s.transactions)
  const dolarStatus = useTransactionStore((s) => s.status)
  const cryptoStatus = useCryptoStore((s) => s.status)
  const cryptoCount = useCryptoStore((s) => s.transactions.length)
  const { positions } = useCryptoPortfolio()
  const allDolarData = useDolarStore((s) => s.allDolarData)

  const cryptoArsRate = allDolarData?.[DolarOption.Cripto]
    ? Number(allDolarData[DolarOption.Cripto].compra) || null
    : null

  const overview = useMemo(
    () =>
      computePortfolioOverview({
        dolarData,
        // DolarAPI trae el nombre largo ("Contado con liquidación"); sin cotizaciones, el id
        dolarLabel: (option) => `Dólar ${allDolarData?.[option]?.nombre ?? option}`,
        cryptoPositions: positions,
        cryptoArsRate,
      }),
    [dolarData, allDolarData, positions, cryptoArsRate],
  )

  const hasOperations =
    cryptoCount > 0 || Object.values(dolarTransactions).some((g) => g && g.length > 0)

  const retry = () => {
    for (const store of [useTransactionStore, useCryptoStore]) {
      if (store.getState().status === 'error') void store.getState().retryCloud()
    }
  }

  return {
    overview,
    cryptoArsRate,
    hasOperations,
    status: combine(dolarStatus, cryptoStatus),
    retry,
  }
}
