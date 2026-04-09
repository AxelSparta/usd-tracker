'use client'

import { ThemeProvider } from 'next-themes'
import { useEffect } from 'react'
import { useDolarStore } from '@/store/dolar.store'

export function ClientProviders({ children }: { children: React.ReactNode }) {
  const fetchAllDolars = useDolarStore((state) => state.fetchAllDolars)

  useEffect(() => {
    fetchAllDolars()
    
    // Opcional: refrescar cada 5 minutos
    const interval = setInterval(fetchAllDolars, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchAllDolars])

  return (
    <ThemeProvider attribute='class' defaultTheme='system' enableSystem>
      {children}
    </ThemeProvider>
  )
}
