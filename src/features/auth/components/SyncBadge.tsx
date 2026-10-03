'use client'

import { useAuth } from '@clerk/nextjs'
import { Cloud, CloudOff, HardDrive, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useCloudStatus, useLocalImport } from '../hooks'
import { countLocalData } from '../local-import'
import { describeImportResult, describeLocalData } from './describe'

/**
 * Dónde viven los datos y cómo está la sincronización: "Modo local" sin sesión;
 * con sesión, cargando / guardando / sincronizado / sin conexión. Desde acá se pueden
 * subir a mano las operaciones locales que no están en la cuenta.
 */
export default function SyncBadge() {
  const { isSignedIn } = useAuth()
  const { status, pendingWrites, retry } = useCloudStatus()
  const { pending, upload } = useLocalImport()
  const [uploading, setUploading] = useState(false)
  const pendingCount = countLocalData(pending)

  const state = !isSignedIn
    ? { icon: HardDrive, label: 'Modo local', spin: false }
    : status === 'error'
      ? { icon: CloudOff, label: 'Sin conexión', spin: false }
      : status === 'loading'
        ? { icon: LoaderCircle, label: 'Cargando…', spin: true }
        : pendingWrites > 0 || uploading
          ? { icon: LoaderCircle, label: 'Guardando…', spin: true }
          : { icon: Cloud, label: 'Sincronizado', spin: false }
  const Icon = state.icon

  const handleUpload = async () => {
    setUploading(true)
    try {
      toast.success(describeImportResult(await upload()))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudieron subir las operaciones.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type='button'
          className={cn(
            'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground',
            status === 'error' && isSignedIn && 'text-destructive',
          )}
        >
          <Icon className={cn('size-3.5', state.spin && 'animate-spin')} />
          {state.label}
          {isSignedIn && pendingCount > 0 && (
            <span className='size-1.5 rounded-full bg-primary' aria-label='Hay operaciones locales sin subir' />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-72 space-y-3 text-sm'>
        {!isSignedIn ? (
          <p className='text-muted-foreground'>
            Tus datos se guardan solo en este navegador. Si borrás los datos del sitio o
            cambiás de dispositivo, no vas a verlos. Iniciá sesión para guardarlos en tu
            cuenta.
          </p>
        ) : (
          <>
            <p className='text-muted-foreground'>
              {status === 'error'
                ? 'No se pudieron cargar tus datos de la nube.'
                : 'Tus operaciones se guardan en tu cuenta y las ves en cualquier dispositivo.'}
            </p>
            {status === 'error' && (
              <Button size='sm' variant='outline' className='w-full' onClick={retry}>
                Reintentar
              </Button>
            )}
            {pendingCount > 0 && (
              <div className='space-y-2 border-t pt-3'>
                <p className='text-muted-foreground'>
                  En este navegador hay {describeLocalData(pending)} que no están en tu
                  cuenta.
                </p>
                <Button size='sm' className='w-full' onClick={handleUpload} disabled={uploading}>
                  {uploading ? 'Subiendo…' : 'Subir a mi cuenta'}
                </Button>
              </div>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
