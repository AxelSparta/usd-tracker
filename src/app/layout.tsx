import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import Header from './components/Header'
import { TransactionsProvider } from './context/TransactionsContext'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin']
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin']
})

export const metadata: Metadata = {
  title: 'Seguimiento de compras de USD',
  description: 'Web donde puedes guardar tus compras de USD y ver el precio actual del dolar junto con las ganancias o pérdidas'
}

export default function RootLayout ({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang='es' suppressHydrationWarning>
      <body
        className={`${geistSans.className} ${geistMono.className} antialiased dark:bg-gradient-to-b dark:from-slate-700 dark:via-slate-800 dark:to-slate-950 min-h-screen container mx-auto p-2 xs:p-0`}
      >
        <Providers>
          <TransactionsProvider>
            <Header />
            {children}
          </TransactionsProvider>
        </Providers>
      </body>
    </html>
  )
}
