'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { numberToArInput } from '@/lib/locale-amount'
import { usePesosStore } from '../pesos.store'
import type { PesosMovement } from '../types'
import PesosMovementForm from './PesosMovementForm'

export default function EditPesosMovementDialog({ movement }: { movement: PesosMovement }) {
  const [open, setOpen] = useState(false)
  const updateMovement = usePesosStore((s) => s.updateMovement)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className='size-8 text-muted-foreground hover:text-foreground'
          aria-label='Editar movimiento'
        >
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Editar movimiento</DialogTitle>
          <DialogDescription>
            Se revalida el saldo de pesos en toda la línea temporal.
          </DialogDescription>
        </DialogHeader>
        {/* Radix desmonta el contenido al cerrar: cada apertura arranca con los valores actuales */}
        <PesosMovementForm
          submitLabel='Guardar cambios'
          defaultValues={{
            type: movement.type,
            amount: numberToArInput(movement.amount),
            note: movement.note ?? '',
            date: new Date(movement.date),
          }}
          onSubmit={async (values) => {
            await updateMovement(movement.id, values)
            toast.success('Movimiento actualizado.')
            setOpen(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
