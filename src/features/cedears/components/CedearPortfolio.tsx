'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Stat, pnlClass } from '@/components/Stat'
import SyncGate from '@/components/SyncGate'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatPercent, formatPrice, formatQuantity } from '@/lib/locale-amount'
import { cn } from '@/lib/utils'
import { useCedearsStore } from '../cedears.store'
import { cedearName } from '../catalog'
import { useCedearPortfolio, useCedearPriceSync } from '../hooks'
import { useCedearPricesStore } from '../prices.store'
import CedearTransactionList from './CedearTransactionList'
import CurrencyToggle from './CurrencyToggle'
import { inCurrency, money, signedMoney, type ViewCurrency } from './format'

function PortfolioSkeleton() {
  return (
    <div className='space-y-4'>
      <div className='grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3'>
        {[0, 1, 2].map((i) => (
          <div key={i} className='space-y-3 bg-card p-4'>
            <Skeleton className='h-4 w-20' />
            <Skeleton className='h-7 w-28' />
            <Skeleton className='h-3 w-24' />
          </div>
        ))}
      </div>
      <Skeleton className='h-40 w-full' />
    </div>
  )
}

const updatedAtFormat = new Intl.DateTimeFormat('es-AR', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export default function CedearPortfolio() {
  const status = useCedearsStore((s) => s.status)
  const retryCloud = useCedearsStore((s) => s.retryCloud)
  const ready = status === 'ready'
  useCedearPriceSync()
  const { positions, summary, cclSell } = useCedearPortfolio()
  const prices = useCedearPricesStore((s) => s.prices)
  const [currency, setCurrency] = useState<ViewCurrency>('USD')

  const openPositions = positions.filter((p) => p.quantity > 0)
  const totals = inCurrency(summary, currency)
  // El panel de data912 no trae fecha: se muestra cuándo lo armó (la última consulta exitosa)
  const updatedAt = Math.max(
    0,
    ...openPositions.map((p) => prices[p.ticker]?.updatedAt ?? 0),
  )

  return (
    <div className='space-y-12'>
      <section aria-labelledby='resumen-cedears' className='space-y-4'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <h2 id='resumen-cedears' className='text-sm font-medium text-muted-foreground'>
            Resumen
          </h2>
          <div className='flex items-center gap-3'>
            <p className='text-sm text-muted-foreground tabular-nums'>
              CCL venta {cclSell ? `$${formatCurrency(cclSell)}` : '—'}
            </p>
            <CurrencyToggle value={currency} onChange={setCurrency} />
          </div>
        </div>

        {!ready ? (
          <SyncGate status={status} onRetry={retryCloud} fallback={<PortfolioSkeleton />}>
            {null}
          </SyncGate>
        ) : positions.length === 0 ? (
          <div className='rounded-lg border border-dashed p-10 text-center'>
            <p className='text-sm text-muted-foreground'>
              Todavía no registraste operaciones de CEDEARs.
            </p>
            <Button asChild variant='outline' size='sm' className='mt-4'>
              <Link href='/cedears/nueva'>Agregar la primera</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className='grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3'>
              <Stat
                label='Valor actual'
                value={money(currency, totals.marketValue ?? 0)}
                secondaryLabel={currency === 'USD' ? 'En pesos' : 'En dólares'}
                secondaryValue={
                  currency === 'USD'
                    ? money('ARS', summary.marketValueArs)
                    : cclSell
                      ? money('USD', summary.marketValueUsd)
                      : '—'
                }
              />
              <Stat
                label='Costo'
                value={money(currency, totals.cost)}
                secondaryLabel='Posiciones abiertas'
                secondaryValue={String(openPositions.length)}
              />
              <Stat
                label='PnL no realizado'
                value={signedMoney(currency, totals.unrealized ?? 0)}
                valueClassName={pnlClass(totals.unrealized ?? 0)}
                secondaryLabel='Realizado'
                secondaryValue={signedMoney(currency, totals.realized)}
                secondaryClassName={pnlClass(totals.realized)}
              />
            </div>
            <p className='text-xs text-muted-foreground'>
              Precios de BYMA con demora (data912)
              {updatedAt > 0 && `, actualizados a las ${updatedAtFormat.format(updatedAt)}`}. En
              dólares se valúa al CCL venta.
            </p>
            {summary.hasMissingPrices && (
              <p className='text-xs text-muted-foreground'>
                Hay CEDEARs sin precio (o falta el CCL): no se incluyen en el valor actual.
              </p>
            )}
          </>
        )}
      </section>

      {ready && openPositions.length > 0 && (
        <section aria-labelledby='posiciones-cedears' className='space-y-4'>
          <h2 id='posiciones-cedears' className='text-sm font-medium text-muted-foreground'>
            Posiciones
          </h2>
          <div className='overflow-x-auto rounded-lg border'>
            <table className='min-w-full text-sm'>
              <thead className='border-b text-left text-xs text-muted-foreground'>
                <tr>
                  <th className='px-4 py-3 font-medium'>CEDEAR</th>
                  <th className='px-4 py-3 text-right font-medium'>Precio</th>
                  <th className='px-4 py-3 text-right font-medium'>Cantidad</th>
                  <th className='px-4 py-3 text-right font-medium'>Costo promedio</th>
                  <th className='px-4 py-3 text-right font-medium'>Valor</th>
                  <th className='px-4 py-3 text-right font-medium'>PnL</th>
                </tr>
              </thead>
              <tbody className='divide-y tabular-nums'>
                {openPositions.map((p) => {
                  const values = inCurrency(p, currency)
                  const average = currency === 'ARS' ? p.averageCostArs : p.averageCostUsd
                  const pct =
                    values.unrealized !== null && values.cost > 0
                      ? (values.unrealized / values.cost) * 100
                      : null
                  return (
                    <tr key={p.ticker} className='transition-colors hover:bg-muted/40'>
                      <td className='px-4 py-3'>
                        <Link
                          href={`/cedears/${encodeURIComponent(p.ticker)}`}
                          className='flex items-center gap-2 hover:underline'
                        >
                          <span className='font-medium'>{p.ticker}</span>
                          <span className='hidden text-muted-foreground sm:inline'>
                            {cedearName(p.ticker)}
                          </span>
                        </Link>
                      </td>
                      <td className='whitespace-nowrap px-4 py-3 text-right'>
                        {p.priceArs === null ? '—' : `$${formatPrice(p.priceArs)}`}
                        {p.change24h !== null && (
                          <span className={cn('ml-2 text-xs', pnlClass(p.change24h))}>
                            {formatPercent(p.change24h)}
                          </span>
                        )}
                      </td>
                      <td className='px-4 py-3 text-right'>{formatQuantity(p.quantity)}</td>
                      <td className='px-4 py-3 text-right text-muted-foreground'>
                        {money(currency, average)}
                      </td>
                      <td className='px-4 py-3 text-right font-medium'>
                        {values.marketValue === null ? '—' : money(currency, values.marketValue)}
                      </td>
                      <td className='whitespace-nowrap px-4 py-3 text-right'>
                        {values.unrealized === null ? (
                          '—'
                        ) : (
                          <span className={pnlClass(values.unrealized)}>
                            {signedMoney(currency, values.unrealized)}
                            {pct !== null && (
                              <span className='ml-1 text-xs'>({formatPercent(pct)})</span>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {ready && positions.length > 0 && <CedearTransactionList />}
    </div>
  )
}
