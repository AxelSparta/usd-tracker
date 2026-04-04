'use client'
import Link from 'next/link'
import ThemeSwitch from './ThemeSwitch'

export default function Header() {
  return (
    <header className='flex justify-between items-center'>
      <Link href='/'>
        <h1 className='text-lg font-bold'>COMPRAS USD</h1>
      </Link>
      <div className='flex items-center gap-4'>
        <Link href='/' className='text-sm hover:underline hover:underline-offset-2'>Transacciones</Link>
        <Link href='/new-transaction' className='text-sm hover:underline hover:underline-offset-2'>Nueva transacción</Link>
        <ThemeSwitch />
      </div>
    </header>
  )
}
