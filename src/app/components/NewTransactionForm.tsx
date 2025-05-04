'use client'

import { useTransactions } from '../context/TransactionsContext'

export default function NewTransactionForm () {
  const { addTransaction } = useTransactions()

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

  return (
    <form className='flex flex-col gap-2 max-w-sm mx-auto lg:mx-0 py-4' onSubmit={handleSubmit}>
      <h2 className='text-xl font-bold'>Nueva transacción</h2>
      <input
        id='pesos'
        name='pesos'
        type='number'
        placeholder='Cantidad pesos'
        className='border rounded px-2 py-1 block w-full'
        step='any'
        required
      />
      <input
        id='usd'
        name='usd'
        type='number'
        placeholder='Cantidad USD recibidos'
        className='border rounded px-2 py-1 block w-full'
        step='any'
        required
      />
      <button
        type='submit'
        className='bg-blue-500 text-white px-2 py-1 rounded mx-auto block'
      >
        Guardar
      </button>
    </form>
  )
}
