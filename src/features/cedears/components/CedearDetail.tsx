'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, Plus } from 'lucide-react'
import { Stat, pnlClass } from '@/components/Stat'
import SyncGate from '@/components/SyncGate'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPercent, formatPrice, formatQuantity } from '@/lib/locale-amount'
import { cn } from '@/lib/utils'
import { useCedearsStore } from '../cedears.store'
import { cedearName } from '../catalog'
import { useCedearPortfolio, useCedearPriceSync } from '../hooks'
import CedearTransactionList from './CedearTransactionList'
import CurrencyToggle from './CurrencyToggle'
import { inCurrency, money, signedMoney, type ViewCurrency } from './format'

/** Posición y operaciones de un solo CEDEAR (`/cedears/[ticker]`). */
export default function CedearDetail({ ticker }: { ticker: string }) {
  const status = useCedearsStore((s) => s.status)
  const retryCloud = useCedearsStore((s) => s.retryCloud)
  useCedearPriceSync()
  const { positions } = useCedearPortfolio()
  const [currency, setCurrency] = useState<ViewCurrency>('USD')
  const position = positions.find((p) => p.ticker === ticker)
  const name = cedearName(ticker)

  const backLink = (
    <Button asChild variant='ghost' size='sm' className='-ml-3 text-muted-foreground'>
      <Link href='/cedears'>
        <ArrowLeft />
        CEDEARs
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
          <p className='text-sm text-muted-foreground'>No tenés operaciones de este CEDEAR.</p>
          <Button asChild variant='outline' size='sm' className='mt-4'>
            <Link href='/cedears/nueva'>Registrar una</Link>
          </Button>
        </div>
      </div>
    )
  }

  const isOpen = position.quantity > 0
  const values = inCurrency(position, currency)
  const average = currency === 'ARS' ? position.averageCostArs : position.averageCostUsd

  return (
    <div className='space-y-12'>
      <header className='space-y-4'>
        {backLink}
        <div className='flex flex-wrap items-end justify-between gap-4'>
          <div>
            <h1 className='text-2xl font-semibold tracking-tight'>{name ?? ticker}</h1>
            <p className='text-sm text-muted-foreground tabular-nums'>
              {ticker}
              {position.priceArs !== null && (
                <>
                  <span className='mx-1.5'>·</span>${formatPrice(position.priceArs)}
                  {position.change24h !== null && (
                    <span className={cn('ml-2 text-xs', pnlClass(position.change24h))}>
                      {formatPercent(position.change24h)} hoy
                    </span>
                  )}
                </>
              )}
            </p>
          </div>
          <Button asChild size='sm'>
            <Link href='/cedears/nueva'>
              <Plus />
              Nueva operación
            </Link>
          </Button>
        </div>
      </header>

      <section aria-labelledby='posicion-cedear' className='space-y-4'>
        <div className='flex items-center justify-between gap-2'>
          <h2 id='posicion-cedear' className='text-sm font-medium text-muted-foreground'>
            Posición
          </h2>
          <CurrencyToggle value={currency} onChange={setCurrency} />
        </div>
        <div className='grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3'>
          <Stat
            label='Valor actual'
            value={values.marketValue === null ? '—' : money(currency, values.marketValue)}
            secondaryLabel='Costo'
            secondaryValue={money(currency, values.cost)}
          />
          <Stat
            label='Cantidad'
            value={`${formatQuantity(position.quantity)} ${ticker}`}
            secondaryLabel='Costo promedio'
            secondaryValue={isOpen ? money(currency, average) : '—'}
          />
          <Stat
            label='PnL no realizado'
            value={values.unrealized === null ? '—' : signedMoney(currency, values.unrealized)}
            valueClassName={values.unrealized === null ? undefined : pnlClass(values.unrealized)}
            secondaryLabel='Realizado'
            secondaryValue={signedMoney(currency, values.realized)}
            secondaryClassName={pnlClass(values.realized)}
          />
        </div>
      </section>

      <CedearTransactionList ticker={ticker} />
    </div>
  )
}
