'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useTransactions } from '../context/TransactionsContext'

const transactionSchema = z.object({
  pesosAmount: z
    .number()
    .nonnegative('La cantidad de pesos no puede ser negativa'),
  usdAmount: z.number().nonnegative('La cantidad de USD no puede ser negativa'),
  date: z.date()
})

export default function NewTransactionForm () {
  const { addTransaction } = useTransactions()
  const form = useForm<z.infer<typeof transactionSchema>>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      pesosAmount: 0,
      usdAmount: 0,
      date: new Date(Date.now())
    }
  })

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const pesos = formData.get('pesos') as string
    const usd = formData.get('usd') as string
    const usdPerPesos = Number(pesos) / Number(usd)
    const transaction = {
      pesos: Number(pesos),
      usd: Number(usd),
      usdPerPesos
    }
    addTransaction(transaction)
    console.log(transaction)
    e.currentTarget.reset()
  }

  function onSubmit(values: z.infer<typeof transactionSchema>) {
    // Do something with the form values.
    // ✅ This will be type-safe and validated.
    console.log(values)
  }

  return (
    <form
      className='flex flex-col gap-2 max-w-sm mx-auto lg:mx-0 py-4'
      onSubmit={handleSubmit}
    >
      <h2 className='text-xl font-bold text-center'>Nueva transacción</h2>
      <input
        id='pesos'
        name='pesos'
        type='number'
        placeholder='Cantidad pesos'
        className='border border-gray-300 rounded px-2 py-1 block w-full'
        step='any'
        required
      />
      <input
        id='usd'
        name='usd'
        type='number'
        placeholder='Cantidad USD recibidos'
        className='border border-gray-300 rounded px-2 py-1 block w-full'
        step='any'
        required
      />
      <button
        type='submit'
        className='bg-blue-500 text-white px-2 py-1 rounded mx-auto block border border-gray-300'
      >
        Guardar
      </button>
    </form>
  )
}
