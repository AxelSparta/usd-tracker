import { ClerkProvider } from '@clerk/nextjs'
import { TransactionsProvider } from './context/TransactionsContext'
import { Providers } from './providers'

import { shadcn } from '@clerk/themes'
import { Inter } from 'next/font/google'
import './globals.css'

import Footer from './components/Footer'
import Header from './components/Header'

import type { Metadata } from 'next'

const inter = Inter({
  subsets: ['latin']
})

export const metadata: Metadata = {
  title: 'Seguimiento de compras de USD',
  description:
    'Web donde puedes guardar tus compras de USD y ver el precio actual del dolar junto con las ganancias o pérdidas'
}

export default function RootLayout ({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: shadcn
      }}
    >
      <html lang='es' suppressHydrationWarning>
        <body
          className={`${inter.className} antialiased dark:bg-gradient-to-b dark:from-slate-700 dark:via-slate-800 dark:to-slate-950 bg-gradient-to-b from-slate-50 via-slate-200 to-slate-300 min-h-screen container mx-auto xs:p-0`}
        >
          <Providers>
            <TransactionsProvider>
              <div className='flex flex-col min-h-screen p-4'>
                <Header />
                {children}
                <Footer />
              </div>
            </TransactionsProvider>
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  )
}
