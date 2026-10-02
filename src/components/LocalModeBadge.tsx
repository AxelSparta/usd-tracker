'use client'

import { useAuth } from '@clerk/nextjs'
import { HardDrive } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

/** Aviso de que los datos viven solo en este navegador (se oculta con la sincronización, Fase 3). */
export default function LocalModeBadge() {
  const { isSignedIn } = useAuth()

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type='button'
          className='flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground'
        >
          <HardDrive className='size-3.5' />
          Modo local
        </button>
      </TooltipTrigger>
      <TooltipContent side='bottom' className='max-w-60 text-center'>
        Tus datos se guardan solo en este navegador. Si borrás los datos del sitio
        o cambiás de dispositivo, no vas a verlos.
        {isSignedIn && ' Aunque iniciaste sesión, la sincronización en la nube todavía no está disponible.'}
      </TooltipContent>
    </Tooltip>
  )
}
