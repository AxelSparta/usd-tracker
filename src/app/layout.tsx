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
  title: {
    default: 'DolarTracker - Seguimiento de Inversiones en USD',
    template: '%s | DolarTracker'
  },
  description:
    'Controlá tu portafolio de dólares en tiempo real. Calculá PnL realizado y no realizado, costo promedio y balance total según el valor del Dólar Blue, MEP, Cripto y más en Argentina.',
  keywords: ['dolar blue', 'dolar mep', 'pnl dolar', 'inversiones argentina', 'calculadora dolar', 'portfolio tracker'],
  authors: [{ name: 'Axel' }],
  creator: 'Axel',
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    url: 'https://usd-tracker.vercel.app/',
    title: 'DolarTracker - Gestión de Portafolio USD',
    description: 'Calculá tus ganancias y pérdidas de tus ahorros en dólares automáticamente con precios actualizados al minuto.',
    siteName: 'DolarTracker',
    images: [
      {
        url: '/page.png',
        width: 1200,
        height: 630,
        alt: 'Preview de DolarTracker',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DolarTracker - Gestión de Portafolio USD',
    description: 'Seguimiento en tiempo real de tus inversiones en dólares en Argentina.',
    images: ['/page.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
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
