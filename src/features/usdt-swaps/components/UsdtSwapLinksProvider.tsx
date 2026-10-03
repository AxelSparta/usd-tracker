'use client'

import { useMemo } from 'react'
import { useCryptoStore } from '@/features/crypto/crypto.store'
import { UsdtSwapLinksContext, type UsdtSwapLinks } from '@/hooks/use-usdt-swap-links'
import { formatQuantity } from '@/lib/locale-amount'
import { removeUsdtSwap } from '../actions'

/** Provee a las listas de cada módulo lo que necesitan de un intercambio USDT ↔ cripto */
export default function UsdtSwapLinksProvider({ children }: { children: React.ReactNode }) {
  const transactions = useCryptoStore((s) => s.transactions)
  const coins = useCryptoStore((s) => s.coins)

  const value = useMemo<UsdtSwapLinks>(
    () => ({
      cryptoSide: (usdtSwapId) => {
        const leg = transactions.find((t) => t.usdtSwapId === usdtSwapId)
        if (!leg) return null
        return `${formatQuantity(leg.quantity)} ${coins[leg.coinId]?.symbol ?? leg.coinId}`
      },
      remove: removeUsdtSwap,
    }),
    [transactions, coins],
  )

  return <UsdtSwapLinksContext.Provider value={value}>{children}</UsdtSwapLinksContext.Provider>
}
