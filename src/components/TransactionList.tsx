'use client'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useTransactionStore } from '@/store/transaction.store'
import { useDolarStore } from '@/store/dolar.store'
import { toast } from 'sonner'
import { Button } from './ui/button'
import Link from 'next/link'
import { DolarOption } from '@/types/dolar.types'
import { Card, CardContent } from './ui/card'
import { formatCurrency } from '@/lib/locale-amount'

export default function TransactionList() {
  const transactionsGrouped = useTransactionStore((state) => state.transactions)
  const removeTransaction = useTransactionStore(
    (state) => state.removeTransaction,
  )
  const transactionsData = useTransactionStore(
    (state) => state.transactionsData,
  )
  const allDolarData = useDolarStore((state) => state.allDolarData)

  const handleDeleteTransaction = async (transactionId: string) => {
    try {
      await removeTransaction({ isSignedIn: false, transactionId })
      toast.success('Transacción eliminada con éxito.')
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Error al eliminar la transacción',
      )
    }
  }

  const hasAnyTransaction = Object.values(transactionsGrouped).some(
    (group) => group && group.length > 0
  )

  if (!hasAnyTransaction) {
    return (
      <section className='mt-8'>
        <h2 className='text-xl font-bold text-center mb-4'>
          Transacciones realizadas
        </h2>
        <p className='text-gray-500 text-center'>
          No hay transacciones realizadas,{' '}
          <Link
            className='underline hover:text-blue-500'
            href='/new-transaction'
          >
            agregá una para empezar
          </Link>
        </p>
      </section>
    )
  }

  return (
    <section className='mt-8 space-y-12'>
      <h2 className='text-2xl font-bold text-center'>
        Historial por Tipo de Dólar
      </h2>

      {Object.entries(transactionsGrouped).map(([option, transactions]) => {
        if (!transactions || transactions.length === 0) return null
        
        const data = transactionsData[option as DolarOption]
        const marketData = allDolarData?.[option as DolarOption]
        
        const sortedTxs = [...transactions].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )

        return (
          <div key={option} className='space-y-6 max-w-5xl mx-auto'>
            {/* Cabecera del Grupo */}
            <div className='flex justify-between items-center border-b pb-3'>
              <div className='flex items-center gap-3'>
                <div className='h-3 w-3 rounded-full bg-blue-500' />
                <h3 className='text-2xl font-bold capitalize tracking-tight'>
                  Dólar {option}
                </h3>
              </div>
              {marketData && (
                <div className='flex gap-4 text-sm font-medium'>
                  <span className='px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-md'>
                    Compra: <span className='text-blue-600 dark:text-blue-400'>${formatCurrency(marketData.compra)}</span>
                  </span>
                  <span className='px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-md'>
                    Venta: <span className='text-green-600 dark:text-green-400'>${formatCurrency(marketData.venta)}</span>
                  </span>
                </div>
              )}
            </div>
            
            {/* Tabla de Transacciones */}
            <div className='overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm'>
              <table className='min-w-full text-sm text-left bg-white dark:bg-gray-900'>
                <thead className='bg-gray-50 dark:bg-gray-800/50 text-xs uppercase font-bold text-gray-500 dark:text-gray-400'>
                  <tr>
                    <th className='px-6 py-4'>Fecha</th>
                    <th className='px-6 py-4'>Operación</th>
                    <th className='px-6 py-4 text-right'>Monto ARS</th>
                    <th className='px-6 py-4 text-right'>Monto USD</th>
                    <th className='px-6 py-4 text-right'>Tipo Cambio</th>
                    <th className='px-6 py-4 text-center'>Acciones</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-gray-100 dark:divide-gray-800'>
                  {sortedTxs.map((tx) => (
                    <tr key={tx.id} className='hover:bg-gray-50/80 dark:hover:bg-gray-800/30 transition-colors'>
                      <td className='px-6 py-4 whitespace-nowrap text-gray-600 dark:text-gray-400 font-medium'>
                        {new Date(tx.date).toLocaleDateString()}
                      </td>
                      <td className='px-6 py-4'>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          tx.type === 'BUY' 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' 
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                        }`}>
                          {tx.type === 'BUY' ? 'COMPRA' : 'VENTA'}
                        </span>
                      </td>
                      <td className='px-6 py-4 text-right font-mono font-semibold'>
                        ${formatCurrency(tx.pesosAmount)}
                      </td>
                      <td className='px-6 py-4 text-right font-mono font-semibold text-blue-600 dark:text-blue-400'>
                        {formatCurrency(tx.dollarsAmount)}
                      </td>
                      <td className='px-6 py-4 text-right font-mono text-gray-500'>
                        ${formatCurrency(tx.pesosAmount / tx.dollarsAmount)}
                      </td>
                      <td className='px-6 py-4 text-center'>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant='ghost' size='sm' className='text-gray-400 hover:text-red-500 transition-colors'>
                              Eliminar
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className='w-56 p-4 shadow-xl'>
                            <p className='text-sm font-medium mb-3'>¿Eliminar esta transacción?</p>
                            <div className='flex gap-2'>
                              <Button
                                className='flex-1'
                                variant='destructive'
                                size='sm'
                                onClick={() => handleDeleteTransaction(tx.id)}
                              >
                                Confirmar
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Resumen de Datos del Grupo */}
            {data && (
              <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
                {/* Bloque: Posición */}
                <Card className='border-none bg-blue-50/50 dark:bg-blue-900/10 shadow-none'>
                  <CardContent className='p-6 space-y-4'>
                    <div className='flex justify-between items-center'>
                      <span className='text-sm text-blue-600 dark:text-blue-400 font-semibold uppercase'>Posición USD</span>
                      <span className='text-2xl font-bold'>{formatCurrency(data.totalUsd)}</span>
                    </div>
                    <div className='flex justify-between items-center pt-2 border-t border-blue-100 dark:border-blue-800/50'>
                      <span className='text-xs text-muted-foreground'>Costo Promedio</span>
                      <span className='text-sm font-bold'>${formatCurrency(data.averageCost)}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Bloque: Capital */}
                <Card className='border-none bg-slate-50 dark:bg-slate-900/40 shadow-none'>
                  <CardContent className='p-6 space-y-4'>
                    <div className='flex justify-between items-center'>
                      <span className='text-sm text-slate-500 uppercase font-semibold'>Valor Actual</span>
                      <span className='text-2xl font-bold text-green-600 dark:text-green-400'>${formatCurrency(data.marketValuePesos)}</span>
                    </div>
                    <div className='flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800'>
                      <span className='text-xs text-muted-foreground'>Total Invertido</span>
                      <span className='text-sm font-bold text-slate-500'>${formatCurrency(data.investedPesos)}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Bloque: Ganancias */}
                <Card className='border-none bg-gray-50 dark:bg-gray-900/60 shadow-none'>
                  <CardContent className='p-6 space-y-4'>
                    <div className='flex justify-between items-center'>
                      <span className='text-sm text-slate-500 uppercase font-semibold'>PnL No Realizado</span>
                      <span className={`text-2xl font-bold ${data.unrealizedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${formatCurrency(data.unrealizedProfit)}
                      </span>
                    </div>
                    <div className='flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-800'>
                      <span className='text-xs text-muted-foreground'>Ganancia Realizada</span>
                      <span className={`text-sm font-bold ${data.realizedProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        ${formatCurrency(data.realizedProfit)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}
