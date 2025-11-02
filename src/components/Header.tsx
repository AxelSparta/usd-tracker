'use client'
import Link from 'next/link'
import ThemeSwitch from './ThemeSwitch'


export default function Header () {
  return (
    <header className='flex justify-between items-center p-2'>
      <Link href='/'>
        <h1 className='text-xl font-bold'>COMPRAS USD</h1>
      </Link>

      <nav className='flex items-center gap-2'>
        <ul className='flex items-center gap-4'>
          <ThemeSwitch />
        </ul>
      </nav>
    </header>
  )
}
