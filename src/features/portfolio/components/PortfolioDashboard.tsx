'use client'

import DolarPrice from '@/components/DolarPrice'
import Segmented from '@/components/Segmented'
import { Stat, pnlClass } from '@/components/Stat'
import SyncGate from '@/components/SyncGate'
import { Skeleton } from '@/components/ui/skeleton'
import { useCedearPriceSync } from '@/features/cedears/hooks'
import { useCryptoPriceSync } from '@/features/crypto/hooks'
import { formatCurrency } from '@/lib/locale-amount'
import { cn } from '@/lib/utils'
import { usePortfolios, usePortfoliosStore } from '@/features/portfolios/portfolios.store'
import { useDashboardPortfolios, useOtherHeldAssets, usePortfolioOverview } from '../hooks'
import { toAllocationSegments } from '../overview'
import AllocationBar from './AllocationBar'
import AssetTable from './AssetTable'
import ValueChart from './ValueChart'

const listFormat = new Intl.ListFormat('es', { type: 'conjunction' })

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
 * Home con datos: valor total, resumen por módulo y composición por activo, del portafolio activo
 * o de todos sumados. Sin operaciones muestra `onboarding` (la presentación de la app), salvo que
 * haya varios portafolios: ahí, un aviso de portafolio vacío.
 */
export default function PortfolioDashboard({ onboarding }: { onboarding: React.ReactNode }) {
  const { sets, showAll, status, retry } = useDashboardPortfolios()
  const others = useOtherHeldAssets(sets)
  useCryptoPriceSync(others.coinIds)
  useCedearPriceSync(others.tickers)
  const { overview, hasOperations, hasPesos, hasCedears, pesosBalance } = usePortfolioOverview(sets)
  const { portfolios, active } = usePortfolios()
  const setShowAll = usePortfoliosStore((s) => s.setShowAll)
  const several = portfolios.length > 1

  if (status !== 'ready') {
    return (
      <SyncGate status={status} onRetry={retry} fallback={<DashboardSkeleton />}>
        {null}
      </SyncGate>
    )
  }
  // Un portafolio vacío entre varios: no es la primera visita, no va la presentación
  if (!hasOperations && !several) return onboarding

  const { totalArs, totalUsd, dolar, crypto, pesos, cedears, assets, missingPrices } = overview
  const segments = toAllocationSegments(assets)
  const tiles = 3 + Number(hasPesos) + Number(hasCedears)
  const held = [
    hasPesos && 'pesos',
    'dólares',
    hasCedears && 'CEDEARs',
    'cripto',
  ].filter((part): part is string => !!part)

  const header = (
    <header className='flex flex-wrap items-end justify-between gap-3'>
      <div className='space-y-1'>
        <h1 className='text-2xl font-semibold tracking-tight'>
          {!several ? 'Tu portfolio' : showAll ? 'Todos tus portafolios' : active?.name}
        </h1>
        <p className='text-sm text-muted-foreground'>
          Tus {listFormat.format(held)} valuados con las cotizaciones actuales.
        </p>
      </div>
      {several && active && (
        <Segmented
          label='Qué portafolio ver'
          options={[
            { value: 'active', label: active.name },
            { value: 'all', label: `Todos (${portfolios.length})` },
          ]}
          value={showAll ? 'all' : 'active'}
          onChange={(value) => setShowAll(value === 'all')}
        />
      )}
    </header>
  )

  if (!hasOperations) {
    return (
      <div className='space-y-12'>
        {header}
        <div className='rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground'>
          Este portafolio todavía no tiene operaciones. Cargá la primera desde los trackers.
        </div>
      </div>
    )
  }

  return (
    <div className='space-y-12'>
      {header}

      <section
        aria-label='Resumen'
        className={cn(
          'grid gap-px overflow-hidden rounded-lg border bg-border',
          tiles === 3 && 'sm:grid-cols-3',
          tiles === 4 && 'sm:grid-cols-2 lg:grid-cols-4',
          // Con cinco, el total ocupa la primera fila en tablet
          tiles === 5 &&
            'sm:grid-cols-2 sm:[&>*:first-child]:col-span-2 lg:grid-cols-5 lg:[&>*:first-child]:col-span-1',
        )}
      >
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
          secondaryValue={signed('$', dolar.pnl ?? 0)}
          secondaryClassName={pnlClass(dolar.pnl ?? 0)}
        />
        <Stat
          label='Cripto'
          value={`US$${formatCurrency(crypto.valueUsd)}`}
          secondaryLabel='Ganancia'
          secondaryValue={signed('US$', crypto.pnl ?? 0)}
          secondaryClassName={pnlClass(crypto.pnl ?? 0)}
        />
        {/* Un saldo no tiene ganancia: se muestra su equivalente en dólares al MEP */}
        {hasPesos && (
          <Stat
            label='Pesos'
            value={`${pesosBalance < 0 ? '-' : ''}$${formatCurrency(Math.abs(pesosBalance))}`}
            secondaryLabel='En dólares (MEP)'
            secondaryValue={pesos.assets > 0 ? `US$${formatCurrency(pesos.valueUsd)}` : '—'}
          />
        )}
        {hasCedears && (
          <Stat
            label='CEDEARs'
            value={`US$${formatCurrency(cedears.valueUsd)}`}
            secondaryLabel='Ganancia'
            secondaryValue={signed('US$', cedears.pnl ?? 0)}
            secondaryClassName={pnlClass(cedears.pnl ?? 0)}
          />
        )}
      </section>

      <ValueChart sets={sets} />

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
