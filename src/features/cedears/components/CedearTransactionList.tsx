'use client'

import Link from 'next/link'
import { Banknote, DollarSign, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { sortTxs } from '@/domain/timeline'
import { formatCurrency, formatPrice, formatQuantity } from '@/lib/locale-amount'
import { operationLabel } from '@/lib/operation-label'
import { cn } from '@/lib/utils'
import { removeCedearTransaction } from '../actions'
import { useCedearsStore } from '../cedears.store'
import { cedearTotal } from '../metrics'
import type { CedearTransaction } from '../types'
import EditCedearTransactionDialog from './EditCedearTransactionDialog'

type CedearTransactionListProps = {
  /** Solo las operaciones de este ticker (detalle por CEDEAR) */
  ticker?: string
}

const money = (tx: CedearTransaction, amount: number) =>
  tx.currency === 'ARS' ? `$${formatPrice(amount)}` : `US$${formatPrice(amount)}`

export default function CedearTransactionList({ ticker }: CedearTransactionListProps) {
  const transactions = useCedearsStore((s) => s.transactions)

  // Más reciente primero; el mismo día, la venta arriba de la compra
  const sorted = sortTxs(transactions.filter((tx) => !ticker || tx.ticker === ticker)).reverse()

  const handleDelete = async (tx: CedearTransaction) => {
    try {
      await removeCedearTransaction(tx.id)
      toast.success('Operación eliminada.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar la operación')
    }
  }

  return (
    <section aria-labelledby='historial-cedears' className='space-y-4'>
      <h2 id='historial-cedears' className='text-sm font-medium text-muted-foreground'>
        Historial
      </h2>
      <div className='overflow-x-auto rounded-lg border'>
        <table className='min-w-full text-sm'>
          <thead className='border-b text-left text-xs text-muted-foreground'>
            <tr>
              <th className='px-4 py-3 font-medium'>Fecha</th>
              <th className='px-4 py-3 font-medium'>CEDEAR</th>
              <th className='px-4 py-3 font-medium'>Operación</th>
              <th className='px-4 py-3 text-right font-medium'>Cantidad</th>
              <th className='px-4 py-3 text-right font-medium'>Precio</th>
              <th className='px-4 py-3 text-right font-medium'>Total</th>
              <th className='px-4 py-3'>
                <span className='sr-only'>Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody className='divide-y tabular-nums'>
            {sorted.map((tx) => {
              const operation = operationLabel(tx)
              const Icon = tx.currency === 'ARS' ? Banknote : DollarSign
              return (
                <tr key={tx.id} className='transition-colors hover:bg-muted/40'>
                  <td className='whitespace-nowrap px-4 py-3 text-muted-foreground'>
                    {new Date(tx.date).toLocaleDateString('es-AR')}
                  </td>
                  <td className='px-4 py-3'>
                    <Link
                      href={`/cedears/${encodeURIComponent(tx.ticker)}`}
                      className='font-medium hover:underline'
                    >
                      {tx.ticker}
                    </Link>
                  </td>
                  <td className='px-4 py-3'>
                    <span
                      className={cn(
                        'text-xs font-medium',
                        operation.positive
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400',
                      )}
                    >
                      {operation.label}
                    </span>
                    <Link
                      href={tx.currency === 'ARS' ? '/pesos' : '/dolar'}
                      className='ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline'
                    >
                      <Icon className='size-3' aria-hidden />
                      {tx.currency === 'ARS' ? 'pesos' : 'dólares CCL'}
                    </Link>
                  </td>
                  <td className='px-4 py-3 text-right'>{formatQuantity(tx.quantity)}</td>
                  <td className='px-4 py-3 text-right text-muted-foreground'>
                    {money(tx, tx.price)}
                    {tx.currency === 'CCL' && (
                      <span className='block text-xs'>CCL ${formatCurrency(tx.fxRate)}</span>
                    )}
                  </td>
                  <td className='whitespace-nowrap px-4 py-3 text-right font-medium'>
                    {money(tx, cedearTotal(tx))}
                    {tx.fee !== undefined && tx.fee > 0 && (
                      <span className='block text-xs font-normal text-muted-foreground'>
                        comisión {money(tx, tx.fee)}
                      </span>
                    )}
                  </td>
                  <td className='px-2 py-1'>
                    <div className='flex justify-end'>
                      <EditCedearTransactionDialog tx={tx} />
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant='ghost'
                            size='icon'
                            className='size-8 text-muted-foreground hover:text-destructive'
                            aria-label='Eliminar operación'
                          >
                            <Trash2 />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align='end' className='w-56 p-3'>
                          <p className='mb-3 text-sm'>
                            ¿Eliminar esta operación? También se elimina su movimiento de{' '}
                            {tx.currency === 'ARS' ? 'pesos' : 'dólares CCL'}.
                          </p>
                          <Button
                            className='w-full'
                            variant='destructive'
                            size='sm'
                            onClick={() => handleDelete(tx)}
                          >
                            Confirmar
                          </Button>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
