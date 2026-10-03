'use client'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  useTransactionStore,
  useTransactionsData,
} from '@/store/transaction.store'
import { summarizeTransactionsData } from '@/domain/metrics'
import { useDolarStore } from '@/store/dolar.store'
import { toast } from 'sonner'
import { Button } from './ui/button'
import Link from 'next/link'
import { DolarOption } from '@/types/dolar.types'
import { formatCurrency } from '@/lib/locale-amount'
import { cn } from '@/lib/utils'
import { Stat, pnlClass } from './Stat'
import EditTransactionDialog from './EditTransactionDialog'
import { Trash2 } from 'lucide-react'
import SyncGate from './SyncGate'
import { Skeleton } from './ui/skeleton'

export default function TransactionList() {
  const transactionsGrouped = useTransactionStore((state) => state.transactions)
  const removeTransaction = useTransactionStore(
    (state) => state.removeTransaction,
  )
  const status = useTransactionStore((state) => state.status)
  const retryCloud = useTransactionStore((state) => state.retryCloud)
  const transactionsData = useTransactionsData()
  const allDolarData = useDolarStore((state) => state.allDolarData)

  const handleDeleteTransaction = async (transactionId: string) => {
    try {
      await removeTransaction(transactionId)
      toast.success('Transacción eliminada con éxito.')
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Error al eliminar la transacción',
      )
    }
  }

  if (status !== 'ready') {
    return (
      <section className='space-y-4'>
        <h2 className='text-sm font-medium text-muted-foreground'>
          Transacciones
        </h2>
        <SyncGate
          status={status}
          onRetry={retryCloud}
          fallback={<Skeleton className='h-40 w-full' />}
        >
          {null}
        </SyncGate>
      </section>
    )
  }

  const hasAnyTransaction = Object.values(transactionsGrouped).some(
    (group) => group && group.length > 0
  )

  if (!hasAnyTransaction) {
    return (
      <section className='space-y-4'>
        <h2 className='text-sm font-medium text-muted-foreground'>
          Transacciones
        </h2>
        <div className='rounded-lg border border-dashed p-10 text-center'>
          <p className='text-sm text-muted-foreground'>
            Todavía no registraste transacciones.
          </p>
          <Button asChild variant='outline' size='sm' className='mt-4'>
            <Link href='/dolar/nueva'>Agregar la primera</Link>
          </Button>
        </div>
      </section>
    )
  }

  const groupsWithData = Object.values(transactionsData).filter(Boolean).length
  const totals = summarizeTransactionsData(transactionsData)

  return (
    <section className='space-y-12'>
      {/* Con un solo tipo de dólar el total repetiría el resumen del grupo */}
      {groupsWithData > 1 && (
        <div className='space-y-4'>
          <h2 className='text-lg font-semibold tracking-tight'>Total</h2>
          <div className='grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3'>
            <Stat
              label='Posición USD'
              value={formatCurrency(totals.totalUsd)}
              secondaryLabel='Tipos de dólar'
              secondaryValue={String(groupsWithData)}
            />
            <Stat
              label='Valor actual'
              value={`$${formatCurrency(totals.marketValuePesos)}`}
              secondaryLabel='Invertido'
              secondaryValue={`$${formatCurrency(totals.investedPesos)}`}
            />
            <Stat
              label='PnL no realizado'
              value={`$${formatCurrency(totals.unrealizedProfit)}`}
              valueClassName={pnlClass(totals.unrealizedProfit)}
              secondaryLabel='Realizado'
              secondaryValue={`$${formatCurrency(totals.realizedProfit)}`}
              secondaryClassName={pnlClass(totals.realizedProfit)}
            />
          </div>
        </div>
      )}

      {Object.entries(transactionsGrouped).map(([option, transactions]) => {
        if (!transactions || transactions.length === 0) return null

        const data = transactionsData[option as DolarOption]
        const marketData = allDolarData?.[option as DolarOption]

        const sortedTxs = [...transactions].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )

        return (
          <div key={option} className='space-y-4'>
            {/* Cabecera del grupo */}
            <div className='flex flex-wrap items-baseline justify-between gap-2'>
              <h2 className='text-lg font-semibold capitalize tracking-tight'>
                Dólar {option}
              </h2>
              {marketData && (
                <p className='text-sm text-muted-foreground tabular-nums'>
                  Compra ${formatCurrency(marketData.compra)}
                  <span className='mx-1.5'>·</span>
                  Venta ${formatCurrency(marketData.venta)}
                </p>
              )}
            </div>

            {/* Resumen del grupo */}
            {data && (
              <div className='grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3'>
                <Stat
                  label='Posición USD'
                  value={formatCurrency(data.totalUsd)}
                  secondaryLabel='Costo promedio'
                  secondaryValue={`$${formatCurrency(data.averageCost)}`}
                />
                <Stat
                  label='Valor actual'
                  value={`$${formatCurrency(data.marketValuePesos)}`}
                  secondaryLabel='Invertido'
                  secondaryValue={`$${formatCurrency(data.investedPesos)}`}
                />
                <Stat
                  label='PnL no realizado'
                  value={`$${formatCurrency(data.unrealizedProfit)}`}
                  valueClassName={pnlClass(data.unrealizedProfit)}
                  secondaryLabel='Realizado'
                  secondaryValue={`$${formatCurrency(data.realizedProfit)}`}
                  secondaryClassName={pnlClass(data.realizedProfit)}
                />
              </div>
            )}

            {/* Tabla de transacciones */}
            <div className='overflow-x-auto rounded-lg border'>
              <table className='min-w-full text-sm'>
                <thead className='border-b text-left text-xs text-muted-foreground'>
                  <tr>
                    <th className='px-4 py-3 font-medium'>Fecha</th>
                    <th className='px-4 py-3 font-medium'>Operación</th>
                    <th className='px-4 py-3 text-right font-medium'>ARS</th>
                    <th className='px-4 py-3 text-right font-medium'>USD</th>
                    <th className='px-4 py-3 text-right font-medium'>Tipo de cambio</th>
                    <th className='px-4 py-3'>
                      <span className='sr-only'>Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody className='divide-y tabular-nums'>
                  {sortedTxs.map((tx) => (
                    <tr key={tx.id} className='transition-colors hover:bg-muted/40'>
                      <td className='whitespace-nowrap px-4 py-3 text-muted-foreground'>
                        {new Date(tx.date).toLocaleDateString('es-AR')}
                      </td>
                      <td className='px-4 py-3'>
                        <span
                          className={cn(
                            'text-xs font-medium',
                            tx.type === 'BUY'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-600 dark:text-amber-400',
                          )}
                        >
                          {tx.type === 'BUY' ? 'Compra' : 'Venta'}
                        </span>
                      </td>
                      <td className='px-4 py-3 text-right'>
                        ${formatCurrency(tx.pesosAmount)}
                      </td>
                      <td className='px-4 py-3 text-right font-medium'>
                        {formatCurrency(tx.dollarsAmount)}
                      </td>
                      <td className='px-4 py-3 text-right text-muted-foreground'>
                        ${formatCurrency(tx.pesosAmount / tx.dollarsAmount)}
                      </td>
                      <td className='px-2 py-1'>
                        <div className='flex justify-end'>
                          <EditTransactionDialog tx={tx} />
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant='ghost'
                                size='icon'
                                className='size-8 text-muted-foreground hover:text-destructive'
                                aria-label='Eliminar transacción'
                              >
                                <Trash2 />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent align='end' className='w-56 p-3'>
                              <p className='mb-3 text-sm'>¿Eliminar esta transacción?</p>
                              <Button
                                className='w-full'
                                variant='destructive'
                                size='sm'
                                onClick={() => handleDeleteTransaction(tx.id)}
                              >
                                Confirmar
                              </Button>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </section>
  )
}
