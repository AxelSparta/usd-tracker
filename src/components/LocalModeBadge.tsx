'use client'

import { useAuth } from '@clerk/nextjs'
import { Cloud, HardDrive } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

/**
 * Dónde viven los datos: en este navegador (sin sesión) o en la cuenta (con sesión).
 * La Fase 3 suma el estado de sincronización y la subida de los datos locales.
 */
export default function LocalModeBadge() {
  const { isSignedIn } = useAuth()
  const Icon = isSignedIn ? Cloud : HardDrive

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type='button'
          className='flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground'
        >
          <Icon className='size-3.5' />
          {isSignedIn ? 'En la nube' : 'Modo local'}
        </button>
      </TooltipTrigger>
      <TooltipContent side='bottom' className='max-w-60 text-center'>
        {isSignedIn
          ? 'Tus operaciones se guardan en tu cuenta y las ves en cualquier dispositivo. Lo que cargaste sin sesión sigue en este navegador: pronto vas a poder subirlo.'
          : 'Tus datos se guardan solo en este navegador. Si borrás los datos del sitio o cambiás de dispositivo, no vas a verlos.'}
      </TooltipContent>
    </Tooltip>
  )
}
