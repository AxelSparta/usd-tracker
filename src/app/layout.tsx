import { Inter } from 'next/font/google'
import './globals.css'

import Footer from '../components/Footer'
import Header from '../components/Header'

import type { Metadata } from 'next'
import { ClientProviders } from './providers'
import { Toaster } from 'sonner'

const inter = Inter({
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Seguimiento de compras de USD',
  description:
    'Aplicación web para registrar y gestionar compras de dólares, que muestra el valor actual del dólar en Argentina y calcula automáticamente tus ganancias o pérdidas en tiempo real.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang='es' suppressHydrationWarning>
      <body
        className={`${inter.className} antialiased dark:bg-linear-to-b dark:from-slate-800 dark:via-slate-850 dark:to-slate-950 bg-linear-to-b from-slate-50 via-slate-150 to-slate-200 min-h-screen`}
      >
        <ClientProviders>
          <main className='container mx-auto flex flex-col p-4 min-h-screen'>
            <Header />
            {children}
            <Footer />
          </main>
          <Toaster richColors closeButton position='top-center' />
        </ClientProviders>
      </body>
    </html>
  )
}
