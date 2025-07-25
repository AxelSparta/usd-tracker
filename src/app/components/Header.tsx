'use client'

import ThemeSwitch from './ThemeSwitch'
import { useTransactions } from '../context/TransactionsContext'
import { DolarOption } from '../utils/dolarApi'

export default function Header () {
  const { changeDolarOption, dolarOption } = useTransactions()
  return (
    <header className='flex justify-between items-center p-2'>
      <h1 className='text-xl font-bold'>COMPRAS USD</h1>
      <select
        value={dolarOption}
        className='border rounded px-2 py-1 cursor-pointer border-gray-300'
        onChange={e => changeDolarOption(e.target.value as DolarOption)}
      >
        <option className='dark:text-gray-900' value='oficial'>
          Dolar Oficial
        </option>
        <option className='dark:text-gray-900' value='blue'>
          Dolar Blue
        </option>
        <option className='dark:text-gray-900' value='bolsa'>
          Dolar Bolsa
        </option>
        <option className='dark:text-gray-900' value='contadoconliqui'>
          Dolar CCL
        </option>
        <option className='dark:text-gray-900' value='tarjeta'>
          Dolar Tarjeta
        </option>
        <option className='dark:text-gray-900' value='mayorista'>
          Dolar Mayorista
        </option>
        <option className='dark:text-gray-900' value='cripto'>
          Dolar Cripto
        </option>
      </select>
      <ThemeSwitch />
    </header>
  )
}
