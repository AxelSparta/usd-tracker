import { Inter } from 'next/font/google'
import './globals.css'

import Footer from '../components/Footer'
import Header from '../components/Header'

import type { Metadata } from 'next'
import { ClientProviders } from './providers'

const inter = Inter({
  subsets: ['latin']
})

export const metadata: Metadata = {
  title: 'Seguimiento de compras de USD',
  description:
    'Aplicación web para registrar y gestionar compras de dólares, que muestra el valor actual del dólar en Argentina y calcula automáticamente tus ganancias o pérdidas en tiempo real.'
}

export default function RootLayout ({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang='es' suppressHydrationWarning>
      <body
        className={`${inter.className} antialiased dark:bg-gradient-to-b dark:from-slate-700 dark:via-slate-800 dark:to-slate-950 bg-gradient-to-b from-slate-50 via-slate-200 to-slate-300 min-h-screen container mx-auto xs:p-0`}
      >
        <ClientProviders>
          <div className='flex flex-col min-h-screen p-4'>
            <Header />
            {children}
            <Footer />
          </div>
        </ClientProviders>
      </body>
    </html>
  )
}
