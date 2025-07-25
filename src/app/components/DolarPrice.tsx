'use client'

import dayjs from 'dayjs'
import { useTransactions } from '@/app/context/TransactionsContext'

export default function DolarPrice () {
  const { dolarData } = useTransactions()
  return (
    <div className='flex flex-col items-center gap-2 p-2'>
      <p className='font-bold'>Dolar: {dolarData?.nombre}</p>
      <p>Compra: ${dolarData?.compra}</p>
      <p>Venta: ${dolarData?.venta}</p>
      <p className='text-sm'>
        Última fecha de actualización:{' '}
        {dayjs(dolarData?.fechaActualizacion).format('DD/MM/YYYY')}
      </p>
    </div>
  )
}
