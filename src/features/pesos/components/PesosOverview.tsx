'use client'

import Link from 'next/link'
import { Stat } from '@/components/Stat'
import SyncGate from '@/components/SyncGate'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/locale-amount'
import { useDolarStore } from '@/store/dolar.store'
import { DolarOption } from '@/types/dolar.types'
import { TransactionType } from '@/types/transaction.types'
import { computePesosBalance } from '../operations'
import { usePesosStore } from '../pesos.store'
import PesosMovementList from './PesosMovementList'

const ars = (n: number) => `${n < 0 ? '-' : ''}$${formatCurrency(Math.abs(n))}`

function OverviewSkeleton() {
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

export default function PesosOverview() {
  const status = usePesosStore((s) => s.status)
  const retryCloud = usePesosStore((s) => s.retryCloud)
  const movements = usePesosStore((s) => s.movements)
  const mep = useDolarStore((s) => s.allDolarData?.[DolarOption.Bolsa])

  // Lo que cuesta pasar los pesos a dólares en el mercado: MEP venta (D3)
  const mepRate = mep ? Number(mep.venta) : null
  const balance = computePesosBalance(movements)
  const total = (type: TransactionType) =>
    movements.filter((m) => m.type === type).reduce((sum, m) => sum + m.amount, 0)
  const count = (type: TransactionType) => movements.filter((m) => m.type === type).length

  return (
    <div className='space-y-12'>
      <section aria-labelledby='resumen-pesos' className='space-y-4'>
        <div className='flex flex-wrap items-baseline justify-between gap-2'>
          <h2 id='resumen-pesos' className='text-sm font-medium text-muted-foreground'>
            Resumen
          </h2>
          <p className='text-sm text-muted-foreground tabular-nums'>
            Dólar MEP venta {mep ? `$${formatCurrency(mep.venta)}` : '—'}
          </p>
        </div>

        {status !== 'ready' ? (
          <SyncGate status={status} onRetry={retryCloud} fallback={<OverviewSkeleton />}>
            {null}
          </SyncGate>
        ) : movements.length === 0 ? (
          <div className='rounded-lg border border-dashed p-10 text-center'>
            <p className='text-sm text-muted-foreground'>
              Todavía no registraste movimientos de pesos.
            </p>
            <Button asChild variant='outline' size='sm' className='mt-4'>
              <Link href='/pesos/nueva'>Registrar el primero</Link>
            </Button>
          </div>
        ) : (
          <div className='grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3'>
            <Stat
              label='Saldo'
              value={ars(balance)}
              secondaryLabel='En dólares (MEP)'
              secondaryValue={mepRate ? `US$${formatCurrency(balance / mepRate)}` : '—'}
            />
            <Stat
              label='Ingresos'
              value={ars(total(TransactionType.BUY))}
              secondaryLabel='Movimientos'
              secondaryValue={String(count(TransactionType.BUY))}
            />
            <Stat
              label='Egresos'
              value={ars(total(TransactionType.SELL))}
              secondaryLabel='Movimientos'
              secondaryValue={String(count(TransactionType.SELL))}
            />
          </div>
        )}
      </section>

      {status === 'ready' && movements.length > 0 && <PesosMovementList />}
    </div>
  )
}
