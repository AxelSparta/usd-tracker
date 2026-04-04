'use client'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useTransactionStore } from '@/store/transaction.store'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from './ui/button'
import Link from 'next/link'
import { DolarOption } from '@/types/dolar.types'

export default function TransactionList() {
  const transactionsGrouped = useTransactionStore((state) => state.transactions)
  const removeTransaction = useTransactionStore(
    (state) => state.removeTransaction,
  )
  const transactionsData = useTransactionStore(
    (state) => state.transactionsData,
  )
  const getTransactions = useTransactionStore((state) => state.getTransactions)

  const transactions = Object.values(transactionsGrouped).flat().sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  useEffect(() => {
    getTransactions({ isSignedIn: false })
  }, [])

  const handleDeleteTransaction = (transactionId: string) => {
    let transaction = null
    for (const option in transactionsGrouped) {
      const found = transactionsGrouped[option as DolarOption]?.find(tx => tx.id === transactionId)
      if (found) {
        transaction = found
        break
      }
    }

    if (!transaction) return

    const data = transactionsData[transaction.dolarOption]
    if (
      data &&
      transaction.type === 'BUY' &&
      transaction.dollarsAmount > data.totalUsd
    ) {
      toast.error(
        'Ups, no podés borrar esta transacción: quedarías con dólares negativos.',
      )
      return
    }
    
    removeTransaction({ isSignedIn: false, transactionId })
    toast.success('Transacción eliminada con éxito.')
  }

  return (
    <section>
      <h2 className='text-xl font-bold text-center mb-4'>
        Transacciones realizadas
      </h2>
      {/* SIN TRANSACTIONS */}
      {transactions.length === 0 && (
        <p className='text-gray-500 text-center'>
          No hay transacciones realizadas,{' '}
          <Link
            className='underline hover:text-blue-500'
            href='/new-transaction'
          >
            agregá una para empezar
          </Link>
        </p>
      )}
      <div className='overflow-x-auto'>
        {transactions.length > 0 && (
          <>
            <table className='min-w-full text-sm text-left text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 table-auto border border-gray-300 dark:border-gray-900'>
              <thead className='bg-gray-100 dark:bg-gray-800 text-xs uppercase text-gray-600 dark:text-gray-400'>
                <tr>
                  <th scope='col' className='px-2 py-2'>
                    Pesos
                  </th>
                  <th scope='col' className='px-2 py-2'>
                    USD
                  </th>
                  <th scope='col' className='px-2 py-2'>
                    USD por peso
                  </th>
                  <th scope='col' className='px-2 py-2'>
                    Tipo
                  </th>
                  <th scope='col' className='px-2 py-2'>
                    Dolar
                  </th>
                  <th scope='col' className='px-2 py-2'>
                    Fecha
                  </th>
                  <th scope='col' className='px-2 py-2'>
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr
                    className='border-b dark:border-gray-900 hover:bg-gray-200 dark:hover:bg-gray-900 transition-colors'
                    key={transaction.id}
                  >
                    <td className='px-2 py-2'>
                      {transaction.pesosAmount.toFixed(2)}ARS
                    </td>
                    <td className='px-2 py-2'>
                      {transaction.dollarsAmount.toFixed(2)}USD
                    </td>
                    <td className='px-2 py-2'>
                      {transaction.usdPrice.toFixed(2)}
                      USD
                    </td>
                    <td className='px-2 py-2'>
                      {transaction.type === 'BUY' ? 'Compra' : 'Venta'}
                    </td>
                    <td className='px-2 py-2'>
                      {transaction.dolarOption}
                    </td>
                    <td className='px-2 py-2'>
                      {new Date(transaction.date).toLocaleDateString()}
                    </td>
                    <td className='px-2 py-2'>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            className='cursor-pointer'
                            variant='destructive'
                            size='sm'
                          >
                            Eliminar
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className='flex justify-between items-center gap-4'>
                          <p>¿Estás seguro?</p>
                          <Button
                            className='cursor-pointer'
                            variant='destructive'
                            size='sm'
                            onClick={() =>
                              handleDeleteTransaction(transaction.id)
                            }
                          >
                            Sí
                          </Button>
                        </PopoverContent>
                      </Popover>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Transaction data per Dolar Option */}
            <div className='mt-6 space-y-6'>
              {Object.entries(transactionsData).map(([option, data]) => {
                if (!data || data.totalUsd === 0 && data.realizedProfit === 0) return null
                return (
                  <div key={option} className='flex flex-col py-4 border rounded-lg bg-gray-50 dark:bg-gray-900/50 dark:border-gray-800 shadow-sm'>
                    <h3 className='text-xl font-bold px-4 mb-2 text-blue-600 dark:text-blue-400'>
                      Dólar {option}
                    </h3>
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 px-4'>
                      <p className='text-md font-semibold'>
                        Total USD: <span className='font-normal'>{data.totalUsd.toFixed(2)}</span>
                      </p>
                      <p className='text-md font-semibold'>
                        Total ARS: <span className='font-normal'>{data.totalPesos.toFixed(2)}</span>
                      </p>
                      <p className='text-md font-semibold'>
                        Costo promedio: <span className='font-normal'>{data.averageCost.toFixed(2)} ARS</span>
                      </p>
                      <p className={`text-md font-semibold ${data.realizedProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        Ganancia realizada: <span>{data.realizedProfit.toFixed(2)} ARS</span>
                      </p>
                      <p className={`text-md font-semibold ${data.unrealizedProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        Ganancia no realizada: <span>{data.unrealizedProfit.toFixed(2)} ARS</span>
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
