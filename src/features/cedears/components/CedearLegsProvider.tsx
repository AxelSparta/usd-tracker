'use client'

import { useMemo } from 'react'
import { CedearLegsContext, type CedearLegs } from '@/hooks/use-cedear-legs'
import { TransactionType } from '@/types/transaction.types'
import { useCedearsStore } from '../cedears.store'

/** Provee a las listas de Pesos y del Dólar la descripción de las patas de CEDEARs */
export default function CedearLegsProvider({ children }: { children: React.ReactNode }) {
  const transactions = useCedearsStore((s) => s.transactions)

  const value = useMemo((): CedearLegs => {
    const byId = new Map(transactions.map((tx) => [tx.id, tx]))
    return {
      describe: (cedearId) => {
        const tx = byId.get(cedearId)
        if (!tx) return null
        const verb = tx.type === TransactionType.BUY ? 'Compra' : 'Venta'
        return {
          label: `${verb} de ${tx.quantity} ${tx.ticker}`,
          href: `/cedears/${encodeURIComponent(tx.ticker)}`,
        }
      },
    }
  }, [transactions])

  return <CedearLegsContext.Provider value={value}>{children}</CedearLegsContext.Provider>
}
