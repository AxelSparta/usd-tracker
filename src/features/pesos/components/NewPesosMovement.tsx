'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { DolarOption } from '@/types/dolar.types'
import { usePesosStore } from '../pesos.store'
import ConversionForm from './ConversionForm'
import PesosMovementForm from './PesosMovementForm'

export type NewPesosMode = 'movement' | 'conversion'

const modes: { value: NewPesosMode; label: string }[] = [
  { value: 'movement', label: 'Ingreso / egreso' },
  { value: 'conversion', label: 'Convertir' },
]

type NewPesosMovementProps = {
  initialMode?: NewPesosMode
  /** Tipo de dólar preseleccionado en la conversión */
  dolarOption?: DolarOption
}

export default function NewPesosMovement({
  initialMode = 'movement',
  dolarOption,
}: NewPesosMovementProps) {
  const [mode, setMode] = useState<NewPesosMode>(initialMode)
  const addMovement = usePesosStore((s) => s.addMovement)
  const router = useRouter()

  return (
    <div className='mx-auto w-full max-w-md'>
      <Card className='shadow-none'>
        <CardHeader>
          <CardTitle>
            <h1 className='text-lg tracking-tight'>
              {mode === 'movement' ? 'Nuevo movimiento' : 'Nueva conversión'}
            </h1>
          </CardTitle>
          <CardDescription>
            {mode === 'movement'
              ? 'Registrá un ingreso o un egreso de pesos.'
              : 'Comprá dólares con tus pesos o vendelos y cobrá en pesos.'}
          </CardDescription>
          <div
            role='group'
            aria-label='Tipo de movimiento'
            className='mt-2 grid grid-cols-2 gap-1 rounded-md border p-1'
          >
            {modes.map((m) => (
              <button
                key={m.value}
                type='button'
                aria-pressed={mode === m.value}
                onClick={() => setMode(m.value)}
                className={cn(
                  'rounded-sm px-3 py-1.5 text-sm transition-colors',
                  mode === m.value
                    ? 'bg-muted font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {mode === 'movement' ? (
            <PesosMovementForm
              submitLabel='Guardar movimiento'
              onSubmit={async (movement) => {
                await addMovement(movement)
                toast.success('Movimiento registrado.')
                router.push('/pesos')
              }}
            />
          ) : (
            <ConversionForm defaultDolarOption={dolarOption} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
