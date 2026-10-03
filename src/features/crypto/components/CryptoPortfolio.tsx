'use client'

import Link from 'next/link'
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

export default function CryptoPortfolio() {
  const status = useCryptoStore((s) => s.status)
  const retryCloud = useCryptoStore((s) => s.retryCloud)
  const ready = status === 'ready'
  useCryptoPriceSync()
  const { positions, summary } = useCryptoPortfolio()
  const dolarCripto = useDolarStore((s) => s.allDolarData?.[DolarOption.Cripto])

  // Lo que se obtiene en pesos al vender los USD: cotización de compra del dólar cripto
  const arsRate = dolarCripto ? Number(dolarCripto.compra) : null
  const openPositions = positions.filter((p) => p.quantity > 0)

  return (
    <div className='space-y-12'>
      <section aria-labelledby='resumen-cripto' className='space-y-4'>
        <div className='flex flex-wrap items-baseline justify-between gap-2'>
          <h2 id='resumen-cripto' className='text-sm font-medium text-muted-foreground'>
            Resumen
          </h2>
          <p className='text-sm text-muted-foreground tabular-nums'>
            Dólar cripto{' '}
            {dolarCripto ? (
              <>
                compra ${formatCurrency(dolarCripto.compra)}
                <span className='mx-1.5'>·</span>
                venta ${formatCurrency(dolarCripto.venta)}
              </>
            ) : (
              '—'
            )}
          </p>
        </div>

        {!ready ? (
          <SyncGate status={status} onRetry={retryCloud} fallback={<PortfolioSkeleton />}>
            {null}
          </SyncGate>
        ) : positions.length === 0 ? (
          <div className='rounded-lg border border-dashed p-10 text-center'>
            <p className='text-sm text-muted-foreground'>
              Todavía no registraste operaciones cripto.
            </p>
            <Button asChild variant='outline' size='sm' className='mt-4'>
              <Link href='/cripto/nueva'>Agregar la primera</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className='grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3'>
              <Stat
                label='Valor actual'
                value={usd(summary.marketValueUsd)}
                secondaryLabel='En pesos'
                secondaryValue={
                  arsRate ? `$${formatCurrency(summary.marketValueUsd * arsRate)}` : '—'
                }
              />
              <Stat
                label='Invertido'
                value={usd(summary.investedUsd)}
                secondaryLabel='Posiciones abiertas'
                secondaryValue={String(openPositions.length)}
              />
              <Stat
                label='PnL no realizado'
                value={signedUsd(summary.unrealizedPnlUsd)}
                valueClassName={pnlClass(summary.unrealizedPnlUsd)}
                secondaryLabel='Realizado'
                secondaryValue={signedUsd(summary.realizedPnlUsd)}
                secondaryClassName={pnlClass(summary.realizedPnlUsd)}
              />
            </div>
            {summary.hasMissingPrices && (
              <p className='text-xs text-muted-foreground'>
                Hay monedas sin precio todavía: no se incluyen en el valor actual.
              </p>
            )}
          </>
        )}
      </section>

      {ready && openPositions.length > 0 && (
        <section aria-labelledby='posiciones' className='space-y-4'>
          <h2 id='posiciones' className='text-sm font-medium text-muted-foreground'>
            Posiciones
          </h2>
          <div className='overflow-x-auto rounded-lg border'>
            <table className='min-w-full text-sm'>
              <thead className='border-b text-left text-xs text-muted-foreground'>
                <tr>
                  <th className='px-4 py-3 font-medium'>Moneda</th>
                  <th className='px-4 py-3 text-right font-medium'>Precio</th>
                  <th className='px-4 py-3 text-right font-medium'>Cantidad</th>
                  <th className='px-4 py-3 text-right font-medium'>Costo promedio</th>
                  <th className='px-4 py-3 text-right font-medium'>Valor</th>
                  <th className='px-4 py-3 text-right font-medium'>PnL</th>
                </tr>
              </thead>
              <tbody className='divide-y tabular-nums'>
                {openPositions.map((p) => (
                  <tr key={p.coin.id} className='transition-colors hover:bg-muted/40'>
                    <td className='px-4 py-3'>
                      <Link
                        href={`/cripto/${encodeURIComponent(p.coin.id)}`}
                        className='flex items-center gap-2 hover:underline'
                      >
                        <CoinIcon coin={p.coin} />
                        <span className='font-medium'>{p.coin.symbol}</span>
                        <span className='hidden text-muted-foreground sm:inline'>
                          {p.coin.name}
                        </span>
                      </Link>
                    </td>
                    <td className='whitespace-nowrap px-4 py-3 text-right'>
                      {p.priceUsd === null ? '—' : `US$${formatPrice(p.priceUsd)}`}
                      {p.change24h !== null && (
                        <span className={cn('ml-2 text-xs', pnlClass(p.change24h))}>
                          {formatPercent(p.change24h)}
                        </span>
                      )}
                    </td>
                    <td className='px-4 py-3 text-right'>{formatQuantity(p.quantity)}</td>
                    <td className='px-4 py-3 text-right text-muted-foreground'>
                      US${formatPrice(p.averageCostUsd)}
                    </td>
                    <td className='px-4 py-3 text-right font-medium'>
                      {p.marketValueUsd === null ? '—' : usd(p.marketValueUsd)}
                    </td>
                    <td className='whitespace-nowrap px-4 py-3 text-right'>
                      {p.unrealizedPnlUsd === null ? (
                        '—'
                      ) : (
                        <span className={pnlClass(p.unrealizedPnlUsd)}>
                          {signedUsd(p.unrealizedPnlUsd)}
                          {p.unrealizedPnlPct !== null && (
                            <span className='ml-1 text-xs'>
                              ({formatPercent(p.unrealizedPnlPct)})
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {ready && positions.length > 0 && <CryptoTransactionList />}
    </div>
  )
}
