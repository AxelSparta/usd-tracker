'use client'

import { ThemeProvider } from 'next-themes'
import { useEffect } from 'react'
import { useDolarStore } from '@/store/dolar.store'
import { CloudSync } from '@/features/auth/CloudSync'
import UsdtSwapLinksProvider from '@/features/usdt-swaps/components/UsdtSwapLinksProvider'
import { dolarRefreshDelay } from '@/store/dolar-refresh'

export function ClientProviders({ children }: { children: React.ReactNode }) {
  const fetchAllDolars = useDolarStore((state) => state.fetchAllDolars)

  useEffect(() => {
    let cancelled = false
    let timeout: ReturnType<typeof setTimeout> | undefined
    let failures = 0

    // Cada 5 min; si falla, reintenta antes con backoff (`dolarRefreshDelay`)
    const tick = async () => {
      clearTimeout(timeout)
      const ok = await fetchAllDolars()
      if (cancelled) return
      failures = ok ? 0 : failures + 1
      timeout = setTimeout(tick, dolarRefreshDelay(failures))
    }
    tick()

    // Al volver la conexión, no esperar al próximo intento
    const onOnline = () => {
      if (failures > 0) tick()
    }
    window.addEventListener('online', onOnline)
    return () => {
      cancelled = true
      clearTimeout(timeout)
      window.removeEventListener('online', onOnline)
    }
  }, [fetchAllDolars])

  return (
    <ThemeProvider attribute='class' defaultTheme='system' enableSystem>
      <CloudSync />
      <UsdtSwapLinksProvider>{children}</UsdtSwapLinksProvider>
    </ThemeProvider>
  )
}
