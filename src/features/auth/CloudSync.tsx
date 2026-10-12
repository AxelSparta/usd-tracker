'use client'

import { useAuth } from '@clerk/nextjs'
import { useEffect } from 'react'
import { useCedearsStore } from '@/features/cedears/cedears.store'
import { useCryptoStore } from '@/features/crypto/crypto.store'
import { usePesosStore } from '@/features/pesos/pesos.store'
import { usePortfoliosStore } from '@/features/portfolios/portfolios.store'
import { useTransactionStore } from '@/store/transaction.store'

/** Si Clerk no termina de cargar (sin red, bloqueado), no dejar la app esperando */
const AUTH_TIMEOUT_MS = 4000

const stores = [useTransactionStore, useCryptoStore, usePesosStore, useCedearsStore]

/**
 * Elige el origen de datos de los stores según la sesión: con sesión, la nube
 * (`/api/*`); sin sesión, `localStorage`. Al cambiar de cuenta recarga. Primero se resuelve el
 * portafolio activo: los stores cargan solo ese.
 */
export function CloudSync() {
  const { isLoaded, isSignedIn, userId } = useAuth()

  useEffect(() => {
    // Primero vuelve la copia local (de la clave del portafolio local activo), después se apunta a él
    const switchToLocal = () => {
      stores.forEach((store) => store.getState().disconnectCloud())
      void usePortfoliosStore.getState().connectLocal()
    }

    if (!isLoaded) {
      const timeout = setTimeout(switchToLocal, AUTH_TIMEOUT_MS)
      return () => clearTimeout(timeout)
    }
    if (isSignedIn && userId) {
      let cancelled = false
      void usePortfoliosStore
        .getState()
        .connectCloud(userId)
        .then(() => {
          if (!cancelled) stores.forEach((store) => void store.getState().connectCloud())
        })
      return () => {
        cancelled = true
      }
    } else {
      switchToLocal()
    }
  }, [isLoaded, isSignedIn, userId])

  return null
}
