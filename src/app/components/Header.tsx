'use client'

import Link from 'next/link'
import { useTransactions } from '../context/TransactionsContext'
import { DolarOption } from '../utils/dolarApi'
import ThemeSwitch from './ThemeSwitch'

import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton
} from '@clerk/nextjs'

export default function Header () {
  const { changeDolarOption, dolarOption } = useTransactions()
  return (
    <header className='flex justify-between items-center p-2'>
      <Link href='/'>
        <h1 className='text-xl font-bold'>COMPRAS USD</h1>
      </Link>
      {/* <select
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
      </select> */}

      <nav className='flex items-center gap-2'>
        <ul className='flex items-center gap-4'>
          <SignedIn>
            <li className='flex items-center'>
              <UserButton />
            </li>
          </SignedIn>
          <SignedOut>
            <li>
              <SignInButton mode='modal'>
                <button className='hover:text-slate-700 hover:scale-105 transition-transform cursor-pointer dark:hover:text-slate-300'>
                  Iniciar sesión
                </button>
              </SignInButton>
            </li>
            <li>
              <SignUpButton mode='modal'>
                <button className='hover:text-slate-700 hover:scale-105 transition-transform cursor-pointer dark:hover:text-slate-300'>
                  Registrarse
                </button>
              </SignUpButton>
            </li>
          </SignedOut>
          <ThemeSwitch />
        </ul>
      </nav>
    </header>
  )
}
