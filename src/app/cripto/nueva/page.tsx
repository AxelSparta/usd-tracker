import type { Metadata } from 'next'
import NewCryptoTransaction from '@/features/crypto/components/NewCryptoTransaction'
import NewTradeResult from '@/features/usdt-swaps/components/NewTradeResult'
import SwapForm from '@/features/usdt-swaps/components/SwapForm'

export const metadata: Metadata = {
  title: 'Nueva operación cripto',
}

type SearchParams = Promise<{ modo?: string; desde?: string }>

/**
 * `?modo=intercambio&desde=usdt`: atajo "Intercambiar USDT" desde `/dolar`;
 * `?modo=resultado`: resultado de trade.
 */
export default async function NewCryptoTransactionPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { modo, desde } = await searchParams
  return (
    <NewCryptoTransaction
      initialMode={modo === 'intercambio' ? 'swap' : modo === 'resultado' ? 'result' : 'trade'}
      swapForm={<SwapForm defaultFrom={desde === 'usdt' ? 'usdt' : undefined} />}
      tradeResultForm={<NewTradeResult />}
    />
  )
}
