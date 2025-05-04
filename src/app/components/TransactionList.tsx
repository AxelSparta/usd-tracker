'use client'

import { useTransactions } from '../context/TransactionsContext'

export default function TransactionList () {
  const { transactions, removeTransaction, transactionsData } =
    useTransactions()

  return (
    <div>
      <h2 className='text-xl font-bold text-center mb-4'>
        Transacciones realizadas
      </h2>
      {/* SIN TRANSACTIONS */}
      {transactions.length === 0 && (
        <p className='text-gray-500 text-center'>
          No hay transacciones realizadas
        </p>
      )}
      <div className='overflow-x-auto'>

      
      {transactions.length > 0 && (
        <>
          <table className='min-w-full text-sm text-left text-gray-700 dark:text-gray-200 table-auto'>
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
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction, index) => (
                <tr
                  className='border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors'
                  key={index}
                >
                  <td className='px-2 py-2'>
                    {transaction.pesos.toFixed(2)}ARS
                  </td>
                  <td className='px-2 py-2'>{transaction.usd.toFixed(2)}USD</td>
                  <td className='px-2 py-2'>
                    {transaction?.usdPerPesos?.toFixed(2)}
                    USD
                  </td>
                  <td className='px-2 py-2'>
                    <button
                      type='button'
                      className='text-red-500 hover:text-red-600 border border-red-500 hover:border-red-600 rounded p-2'
                      onClick={() => removeTransaction(index)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className='flex flex-col py-2'>
            <p className='text-lg font-bold px-2 py-2'>
              Total: {transactionsData.totalUsd.toFixed(2)}
              USD
            </p>
            <p className='text-lg font-bold px-2 py-2'>
              Total: {transactionsData.totalPesos.toFixed(2)}
              ARS
            </p>
            <p
              className={`text-lg font-bold ${
                transactionsData.gananciaPerdida > 0
                  ? 'text-green-500'
                  : 'text-red-500'
              }`}
            >
              Ganancia/Perdida: {transactionsData.gananciaPerdida.toFixed(2)}ARS
            </p>
          </div>
        </>
      )}
      </div>
    </div>
  )
}
