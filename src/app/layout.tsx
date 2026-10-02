import { Inter } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { esUY } from '@clerk/localizations'
import './globals.css'

import AppSidebar from '@/components/AppSidebar'
import LocalModeBadge from '@/components/LocalModeBadge'
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

// Clerk toma los colores del tema de shadcn: las variables CSS cambian solas con claro/oscuro
const clerkAppearance = {
  variables: {
    colorPrimary: 'var(--primary)',
    colorPrimaryForeground: 'var(--primary-foreground)',
    colorBackground: 'var(--popover)',
    colorForeground: 'var(--popover-foreground)',
    colorMuted: 'var(--muted)',
    colorMutedForeground: 'var(--muted-foreground)',
    colorInput: 'var(--background)',
    colorInputForeground: 'var(--foreground)',
    colorBorder: 'var(--border)',
    colorRing: 'var(--ring)',
    colorDanger: 'var(--destructive)',
    colorNeutral: 'var(--foreground)',
    borderRadius: 'var(--radius)',
    fontFamily: 'inherit',
  },
}

const SITE_URL = 'https://usd-tracker.vercel.app'

export const metadata: Metadata = {
  // Base para resolver las imágenes OG/Twitter (sin esto apuntan a localhost en el build)
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Portfolio Tracker - Dólar y cripto en Argentina',
    template: '%s | Portfolio Tracker'
  },
  description:
    'Controlá tus dólares y criptomonedas en un solo lugar. Calculá PnL realizado y no realizado, costo promedio y balance total con cotizaciones del mercado argentino y precios de CoinGecko.',
  keywords: ['dolar blue', 'dolar mep', 'pnl dolar', 'inversiones argentina', 'calculadora dolar', 'portfolio tracker', 'cripto', 'bitcoin'],
  authors: [{ name: 'Axel' }],
  creator: 'Axel',
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    url: '/',
    title: 'Portfolio Tracker - Dólar y cripto en Argentina',
    description: 'Calculá las ganancias y pérdidas de tus dólares y criptomonedas automáticamente, con precios actualizados.',
    siteName: 'Portfolio Tracker',
    images: [
      {
        url: '/page.png',
        width: 1200,
        height: 630,
        alt: 'Preview de Portfolio Tracker',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Portfolio Tracker - Dólar y cripto en Argentina',
    description: 'Seguimiento de tus dólares y criptomonedas en Argentina.',
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
        <ClerkProvider localization={esUY} appearance={clerkAppearance}>
          <ClientProviders>
            <SidebarProvider>
              <AppSidebar />
              <SidebarInset>
                <header className='sticky top-0 z-10 flex h-12 items-center justify-between border-b bg-background/80 px-4 backdrop-blur'>
                  <SidebarTrigger className='-ml-1 text-muted-foreground' />
                  <LocalModeBadge />
                </header>
                <div className='mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 md:px-8 md:py-12'>
                  {children}
                </div>
              </SidebarInset>
            </SidebarProvider>
            <Toaster richColors closeButton position='top-center' />
          </ClientProviders>
        </ClerkProvider>
      </body>
    </html>
  )
}
