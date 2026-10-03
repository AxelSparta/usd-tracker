'use client'

import DolarPrice from '@/components/DolarPrice'
import { Stat, pnlClass } from '@/components/Stat'
import SyncGate from '@/components/SyncGate'
import { Skeleton } from '@/components/ui/skeleton'
import { useCryptoPriceSync } from '@/features/crypto/hooks'
import { formatCurrency } from '@/lib/locale-amount'
import { usePortfolioOverview } from '../hooks'
import { toAllocationSegments } from '../overview'
import AllocationBar from './AllocationBar'
import AssetTable from './AssetTable'

const signed = (prefix: string, n: number) =>
  `${n < 0 ? '-' : n > 0 ? '+' : ''}${prefix}${formatCurrency(Math.abs(n))}`

function DashboardSkeleton() {
  return (
    <div className='space-y-12'>
      <div className='grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3'>
        {[0, 1, 2].map((i) => (
          <div key={i} className='space-y-3 bg-card p-4'>
            <Skeleton className='h-4 w-20' />
            <Skeleton className='h-7 w-32' />
            <Skeleton className='h-3 w-24' />
          </div>
        ))}
      </div>
      <Skeleton className='h-6 w-full' />
      <Skeleton className='h-40 w-full' />
    </div>
  )
}

/**
 * Home con datos: valor total, resumen por módulo y composición por activo.
 * Sin operaciones muestra `onboarding` (la presentación de la app).
 */
export default function PortfolioDashboard({ onboarding }: { onboarding: React.ReactNode }) {
  useCryptoPriceSync()
  const { overview, hasOperations, status, retry } = usePortfolioOverview()

  if (status !== 'ready') {
    return (
      <SyncGate status={status} onRetry={retry} fallback={<DashboardSkeleton />}>
        {null}
      </SyncGate>
    )
  }
  if (!hasOperations) return onboarding

  const { totalArs, totalUsd, dolar, crypto, assets, missingPrices } = overview
  const segments = toAllocationSegments(assets)

  return (
    <div className='space-y-12'>
      <header className='space-y-1'>
        <h1 className='text-2xl font-semibold tracking-tight'>Tu portfolio</h1>
        <p className='text-sm text-muted-foreground'>
          Tus dólares y cripto valuados con las cotizaciones actuales.
        </p>
      </header>

      <section aria-label='Resumen' className='grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3'>
        <Stat
          label='Valor total'
          value={totalArs === null ? `US$${formatCurrency(totalUsd)}` : `$${formatCurrency(totalArs)}`}
          secondaryLabel='En dólares'
          secondaryValue={`US$${formatCurrency(totalUsd)}`}
        />
        <Stat
          label='Dólar'
          value={dolar.valueArs === null ? '—' : `$${formatCurrency(dolar.valueArs)}`}
          secondaryLabel='Ganancia'
          secondaryValue={signed('$', dolar.pnl)}
          secondaryClassName={pnlClass(dolar.pnl)}
        />
        <Stat
          label='Cripto'
          value={`US$${formatCurrency(crypto.valueUsd)}`}
          secondaryLabel='Ganancia'
          secondaryValue={signed('US$', crypto.pnl)}
          secondaryClassName={pnlClass(crypto.pnl)}
        />
      </section>

      <section aria-labelledby='composicion' className='space-y-4'>
        <div className='flex flex-wrap items-baseline justify-between gap-2'>
          <h2 id='composicion' className='text-sm font-medium text-muted-foreground'>
            Composición
          </h2>
          <p className='text-xs text-muted-foreground'>Según el valor en dólares de cada activo</p>
        </div>
        {assets.length === 0 ? (
          <div className='rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground'>
            No tenés posiciones abiertas: vendiste todo lo que compraste.
          </div>
        ) : (
          <>
            <AllocationBar segments={segments} />
            <AssetTable assets={assets} segments={segments} />
          </>
        )}
        {missingPrices.length > 0 && (
          <p className='text-xs text-muted-foreground'>
            Todavía sin precio (no suman al total): {missingPrices.join(', ')}.
          </p>
        )}
      </section>

      <DolarPrice />
    </div>
  )
}
