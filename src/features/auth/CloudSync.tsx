'use client'

import { useAuth } from '@clerk/nextjs'
import { useEffect } from 'react'
import { useCryptoStore } from '@/features/crypto/crypto.store'
import { useTransactionStore } from '@/store/transaction.store'

/** Si Clerk no termina de cargar (sin red, bloqueado), no dejar la app esperando */
const AUTH_TIMEOUT_MS = 4000

const stores = [useTransactionStore, useCryptoStore]

/**
 * Elige el origen de datos de los stores según la sesión: con sesión, la nube
 * (`/api/*`); sin sesión, `localStorage`. Al cambiar de cuenta recarga.
 */
export function CloudSync() {
  const { isLoaded, isSignedIn, userId } = useAuth()

  useEffect(() => {
    const switchToLocal = () => stores.forEach((store) => store.getState().disconnectCloud())

    if (!isLoaded) {
      const timeout = setTimeout(switchToLocal, AUTH_TIMEOUT_MS)
      return () => clearTimeout(timeout)
    }
    if (isSignedIn) {
      stores.forEach((store) => void store.getState().connectCloud())
    } else {
      switchToLocal()
    }
  }, [isLoaded, isSignedIn, userId])

  return null
}
