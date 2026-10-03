'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import TradeResultForm from '@/components/TradeResultForm'
import { Label } from '@/components/ui/label'
import CoinCombobox from '@/features/crypto/components/CoinCombobox'
import CryptoTradeResultForm from '@/features/crypto/components/CryptoTradeResultForm'
import { useCryptoStore } from '@/features/crypto/crypto.store'
import type { Coin } from '@/features/crypto/types'
import { useTransactionStore } from '@/store/transaction.store'
import { useUsdtPinned, USDT_COIN } from '../usdt-option'

/**
 * Alta de un resultado de trade: en USDT va al dólar cripto (módulo Dólar); en cualquier otra
 * moneda, al módulo Cripto. Cada módulo pone su formulario; acá solo se elige dónde cae.
 */
export default function NewTradeResult() {
  const router = useRouter()
  const [coin, setCoin] = useState<Coin | null>(null)
  const pinned = useUsdtPinned()
  const addDolar = useTransactionStore((s) => s.addTransaction)
  const addCrypto = useCryptoStore((s) => s.addTransaction)

  const done = (href: string) => {
    toast.success('Resultado registrado.')
    router.push(href)
  }

  return (
    <div className='space-y-4'>
      <div className='space-y-2'>
        <Label htmlFor='trade-result-coin'>Moneda en la que se acreditó</Label>
        <CoinCombobox id='trade-result-coin' value={coin} pinned={pinned} onChange={setCoin} />
      </div>
      {coin?.id === USDT_COIN.id ? (
        <TradeResultForm
          submitLabel='Guardar resultado'
          onSubmit={async (tx) => {
            await addDolar(tx)
            done('/dolar')
          }}
        />
      ) : coin ? (
        // key: cambiar de moneda arranca un form limpio
        <CryptoTradeResultForm
          key={coin.id}
          coin={coin}
          submitLabel='Guardar resultado'
          onSubmit={async (tx, selected) => {
            await addCrypto(tx, selected)
            done('/cripto')
          }}
        />
      ) : (
        <p className='text-sm text-muted-foreground'>
          Futuros, margin o bots: cargá el resultado neto que se acreditó (o se debitó) en la moneda.
        </p>
      )}
    </div>
  )
}
