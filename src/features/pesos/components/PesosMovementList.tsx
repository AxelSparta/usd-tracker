'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { ArrowLeftRight, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { sortTxs } from '@/domain/timeline'
import { DOLAR_LABELS } from '@/lib/dolar-labels'
import { formatCurrency } from '@/lib/locale-amount'
import { pesosMovementLabel } from '@/lib/operation-label'
import { cn } from '@/lib/utils'
import { useTransactionStore } from '@/store/transaction.store'
import type { Transaction } from '@/types/transaction.types'
import { removeConversion } from '../actions'
import { usePesosStore } from '../pesos.store'
import type { PesosMovement } from '../types'
import EditPesosMovementDialog from './EditPesosMovementDialog'

export default function PesosMovementList() {
  const movements = usePesosStore((s) => s.movements)
  const removeMovement = usePesosStore((s) => s.removeMovement)
  const dolarGroups = useTransactionStore((s) => s.transactions)

  // Pata del Dólar de cada conversión (Pesos puede leer el store del Dólar, D2)
  const dolarLegs = useMemo(() => {
    const legs = new Map<string, Transaction>()
    for (const tx of Object.values(dolarGroups).flatMap((group) => group ?? [])) {
      if (tx.conversionId) legs.set(tx.conversionId, tx)
    }
    return legs
  }, [dolarGroups])

  // Más reciente primero; el mismo día, el egreso arriba del ingreso que lo fondeó
  const sorted = sortTxs(movements).reverse()

  const handleDelete = async (movement: PesosMovement) => {
    try {
      // Una pata de una conversión se borra junto con la del Dólar
      if (movement.conversionId) {
        await removeConversion(movement.conversionId)
        toast.success('Conversión eliminada.')
        return
      }
      await removeMovement(movement.id)
      toast.success('Movimiento eliminado.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar el movimiento')
    }
  }

  return (
    <section aria-labelledby='historial-pesos' className='space-y-4'>
      <h2 id='historial-pesos' className='text-sm font-medium text-muted-foreground'>
        Historial
      </h2>
      <div className='overflow-x-auto rounded-lg border'>
        <table className='min-w-full text-sm'>
          <thead className='border-b text-left text-xs text-muted-foreground'>
            <tr>
              <th className='px-4 py-3 font-medium'>Fecha</th>
              <th className='px-4 py-3 font-medium'>Movimiento</th>
              <th className='px-4 py-3 text-right font-medium'>Monto</th>
              <th className='px-4 py-3'>
                <span className='sr-only'>Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody className='divide-y tabular-nums'>
            {sorted.map((movement) => {
              const dolarLeg = movement.conversionId ? dolarLegs.get(movement.conversionId) : undefined
              const operation = pesosMovementLabel(
                movement,
                movement.conversionId
                  ? (dolarLeg ? DOLAR_LABELS[dolarLeg.dolarOption] : '')
                  : undefined,
              )
              return (
                <tr key={movement.id} className='transition-colors hover:bg-muted/40'>
                  <td className='whitespace-nowrap px-4 py-3 text-muted-foreground'>
                    {new Date(movement.date).toLocaleDateString('es-AR')}
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
                    {movement.note && (
                      <span className='block text-xs text-muted-foreground'>{movement.note}</span>
                    )}
                    {dolarLeg && (
                      <Link
                        href='/dolar'
                        className='ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline'
                      >
                        <ArrowLeftRight className='size-3' aria-hidden />
                        US${formatCurrency(dolarLeg.dollarsAmount)} a $
                        {formatCurrency(dolarLeg.pesosAmount / dolarLeg.dollarsAmount)}
                      </Link>
                    )}
                  </td>
                  <td className='whitespace-nowrap px-4 py-3 text-right font-medium'>
                    {operation.positive ? '' : '-'}${formatCurrency(movement.amount)}
                  </td>
                  <td className='px-2 py-1'>
                    <div className='flex justify-end'>
                      {/* Las patas de una conversión se borran completas (8.2) */}
                      {!movement.conversionId && <EditPesosMovementDialog movement={movement} />}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant='ghost'
                            size='icon'
                            className='size-8 text-muted-foreground hover:text-destructive'
                            aria-label='Eliminar movimiento'
                          >
                            <Trash2 />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align='end' className='w-56 p-3'>
                          <p className='mb-3 text-sm'>
                            {movement.conversionId
                              ? '¿Eliminar la conversión completa (pesos y dólares)?'
                              : '¿Eliminar este movimiento?'}
                          </p>
                          <Button
                            className='w-full'
                            variant='destructive'
                            size='sm'
                            onClick={() => handleDelete(movement)}
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
