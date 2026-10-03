'use client'

import Link from 'next/link'
import { ArrowLeft, Plus } from 'lucide-react'
import { Stat, pnlClass } from '@/components/Stat'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import SyncGate from '@/components/SyncGate'
import {
  formatCurrency,
  formatPercent,
  formatPrice,
  formatQuantity,
} from '@/lib/locale-amount'
import { cn } from '@/lib/utils'
import { useDolarStore } from '@/store/dolar.store'
import { DolarOption } from '@/types/dolar.types'
import { useCryptoStore } from '../crypto.store'
import { useCryptoPortfolio, useCryptoPriceSync } from '../hooks'
import CoinIcon from './CoinIcon'
import CryptoTransactionList from './CryptoTransactionList'

const usd = (n: number) => `US$${formatCurrency(n)}`
const signedUsd = (n: number) => `${n < 0 ? '-' : ''}US$${formatCurrency(Math.abs(n))}`

type CryptoCoinDetailProps = {
  coinId: string
}

/** Posición y operaciones de una sola moneda (`/cripto/[coinId]`). */
export default function CryptoCoinDetail({ coinId }: CryptoCoinDetailProps) {
  const status = useCryptoStore((s) => s.status)
  const retryCloud = useCryptoStore((s) => s.retryCloud)
  useCryptoPriceSync()
  const { positions } = useCryptoPortfolio()
  const dolarCripto = useDolarStore((s) => s.allDolarData?.[DolarOption.Cripto])
  const arsRate = dolarCripto ? Number(dolarCripto.compra) : null
  const position = positions.find((p) => p.coin.id === coinId)

  const backLink = (
    <Button asChild variant='ghost' size='sm' className='-ml-3 text-muted-foreground'>
      <Link href='/cripto'>
        <ArrowLeft />
        Cripto
      </Link>
    </Button>
  )

  if (status !== 'ready') {
    return (
      <div className='space-y-8'>
        {backLink}
        <SyncGate
          status={status}
          onRetry={retryCloud}
          fallback={
            <>
              <Skeleton className='h-8 w-48' />
              <Skeleton className='h-28 w-full' />
            </>
          }
        >
          {null}
        </SyncGate>
      </div>
    )
  }

  if (!position) {
    return (
      <div className='space-y-8'>
        {backLink}
        <div className='rounded-lg border border-dashed p-10 text-center'>
          <p className='text-sm text-muted-foreground'>
            No tenés operaciones de esta moneda.
          </p>
          <Button asChild variant='outline' size='sm' className='mt-4'>
            <Link href='/cripto/nueva'>Registrar una</Link>
          </Button>
        </div>
      </div>
    )
  }

  const { coin } = position
  const isOpen = position.quantity > 0

  return (
    <div className='space-y-12'>
      <header className='space-y-4'>
        {backLink}
        <div className='flex flex-wrap items-end justify-between gap-4'>
          <div className='flex items-center gap-3'>
            <CoinIcon coin={coin} size={32} />
            <div>
              <h1 className='text-2xl font-semibold tracking-tight'>{coin.name}</h1>
              <p className='text-sm text-muted-foreground tabular-nums'>
                {coin.symbol}
                {position.priceUsd !== null && (
                  <>
                    <span className='mx-1.5'>·</span>
                    US${formatPrice(position.priceUsd)}
                    {position.change24h !== null && (
                      <span className={cn('ml-2 text-xs', pnlClass(position.change24h))}>
                        {formatPercent(position.change24h)} 24 h
                      </span>
                    )}
                  </>
                )}
              </p>
            </div>
          </div>
          <Button asChild size='sm'>
            <Link href='/cripto/nueva'>
              <Plus />
              Nueva operación
            </Link>
          </Button>
        </div>
      </header>

      <section aria-labelledby='posicion-moneda' className='space-y-4'>
        <h2 id='posicion-moneda' className='text-sm font-medium text-muted-foreground'>
          Posición
        </h2>
        <div className='grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3'>
          <Stat
            label='Valor actual'
            value={position.marketValueUsd === null ? '—' : usd(position.marketValueUsd)}
            secondaryLabel='En pesos'
            secondaryValue={
              arsRate && position.marketValueUsd !== null
                ? `$${formatCurrency(position.marketValueUsd * arsRate)}`
                : '—'
            }
          />
          <Stat
            label='Cantidad'
            value={`${formatQuantity(position.quantity)} ${coin.symbol}`}
            secondaryLabel='Costo promedio'
            secondaryValue={isOpen ? `US$${formatPrice(position.averageCostUsd)}` : '—'}
          />
          <Stat
            label='PnL no realizado'
            value={
              position.unrealizedPnlUsd === null ? '—' : signedUsd(position.unrealizedPnlUsd)
            }
            valueClassName={
              position.unrealizedPnlUsd === null
                ? undefined
                : pnlClass(position.unrealizedPnlUsd)
            }
            secondaryLabel='Realizado'
            secondaryValue={signedUsd(position.realizedPnlUsd)}
            secondaryClassName={pnlClass(position.realizedPnlUsd)}
          />
        </div>
        {position.tradePnlUsd !== 0 && (
          <p className='text-xs text-muted-foreground tabular-nums'>
            El realizado incluye {signedUsd(position.tradePnlUsd)} de resultados de trades.
          </p>
        )}
        {isOpen && (
          <p className='text-xs text-muted-foreground tabular-nums'>
            Costo {usd(position.investedUsd)}
            {position.unrealizedPnlPct !== null &&
              ` · rendimiento ${formatPercent(position.unrealizedPnlPct)}`}
          </p>
        )}
      </section>

      <CryptoTransactionList coinId={coinId} />
    </div>
  )
}
