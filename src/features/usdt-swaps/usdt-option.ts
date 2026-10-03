import type { Coin } from '@/features/crypto/types'
import { formatCurrency } from '@/lib/locale-amount'
import { useTransactionsData } from '@/store/transaction.store'
import { DolarOption } from '@/types/dolar.types'
import { USDT_OPTION_ID } from './validations'

/** Los USDT del dólar cripto, como opción del selector de monedas (no es una moneda de CoinGecko) */
export const USDT_COIN: Coin = { id: USDT_OPTION_ID, symbol: 'USDT', name: 'Dólar cripto', image: null }

/** Opción fija "Dólar cripto · USDT" del `CoinCombobox`, con el saldo actual */
export const useUsdtPinned = () => {
  const balance = useTransactionsData()[DolarOption.Cripto]?.totalUsd ?? 0
  return [{ coin: USDT_COIN, heading: 'Tus USDT', hint: `Saldo ${formatCurrency(balance)}` }]
}
