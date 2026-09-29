import { Inter } from 'next/font/google'
import './globals.css'

import AppSidebar from '@/components/AppSidebar'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'

import type { Metadata } from 'next'
import { ClientProviders } from './providers'
import { Toaster } from 'sonner'

const inter = Inter({
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: {
    default: 'Portfolio Tracker - Dólar y cripto en Argentina',
    template: '%s | Portfolio Tracker'
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
      <body className={`${inter.className} antialiased`}>
        <ClientProviders>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              <header className='sticky top-0 z-10 flex h-12 items-center border-b bg-background/80 px-4 backdrop-blur'>
                <SidebarTrigger className='-ml-1 text-muted-foreground' />
              </header>
              <div className='mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 md:px-8 md:py-12'>
                {children}
              </div>
            </SidebarInset>
          </SidebarProvider>
          <Toaster richColors closeButton position='top-center' />
        </ClientProviders>
      </body>
    </html>
  )
}
