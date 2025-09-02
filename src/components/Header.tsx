'use client'
import Link from 'next/link'
import ThemeSwitch from './ThemeSwitch'

import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton
} from '@clerk/nextjs'

export default function Header () {
  return (
    <header className='flex justify-between items-center p-2'>
      <Link href='/'>
        <h1 className='text-xl font-bold'>COMPRAS USD</h1>
      </Link>

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
