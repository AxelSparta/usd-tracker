'use client'

import { HardDrive } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

/** Aviso de que los datos viven solo en este navegador (se oculta al sumar login en la Fase 3). */
export default function LocalModeBadge() {
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
      </TooltipContent>
    </Tooltip>
  )
}
