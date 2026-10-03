'use client'

import { RotateCw } from 'lucide-react'
import type { SyncStatus } from '@/lib/synced-store'
import { Button } from './ui/button'

type SyncGateProps = {
  status: SyncStatus
  onRetry: () => void
  /** Se muestra mientras se resuelve la sesión o cargan los datos de la nube */
  fallback: React.ReactNode
  children: React.ReactNode
}

/**
 * Muestra los datos solo cuando el store sabe de dónde vienen. Además evita el
 * mismatch de hidratación: en el server y en el primer render el estado es `pending`.
 */
export default function SyncGate({ status, onRetry, fallback, children }: SyncGateProps) {
  if (status === 'pending' || status === 'loading') return fallback
  if (status === 'error') {
    return (
      <div className='rounded-lg border border-dashed p-10 text-center'>
        <p className='text-sm text-muted-foreground'>
          No se pudieron cargar tus datos de la nube.
        </p>
        <Button variant='outline' size='sm' className='mt-4' onClick={onRetry}>
          <RotateCw />
          Reintentar
        </Button>
      </div>
    )
  }
  return children
}
