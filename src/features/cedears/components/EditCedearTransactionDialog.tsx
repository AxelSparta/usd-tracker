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
import { updateCedearTransaction } from '../actions'
import { cedearName } from '../catalog'
import type { CedearTransaction } from '../types'
import CedearTransactionForm from './CedearTransactionForm'

/** Edita la operación y su pata juntas (D6): puede cambiar también cómo se pagó */
export default function EditCedearTransactionDialog({ tx }: { tx: CedearTransaction }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className='size-8 text-muted-foreground hover:text-foreground'
          aria-label='Editar operación'
        >
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent className='max-h-[90dvh] overflow-y-auto sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Editar operación</DialogTitle>
          <DialogDescription>
            Se revalidan las unidades del CEDEAR y el saldo de pesos o de dólares CCL.
          </DialogDescription>
        </DialogHeader>
        {/* Radix desmonta el contenido al cerrar: cada apertura arranca con los valores actuales */}
        <CedearTransactionForm
          submitLabel='Guardar cambios'
          initialCedear={{ ticker: tx.ticker, name: cedearName(tx.ticker) }}
          defaultValues={{
            ticker: tx.ticker,
            type: tx.type,
            quantity: numberToArInput(tx.quantity),
            currency: tx.currency,
            price: numberToArInput(tx.price),
            fxRate: numberToArInput(tx.fxRate),
            fee: tx.fee ? numberToArInput(tx.fee) : '',
            date: new Date(tx.date),
          }}
          onSubmit={async (values) => {
            await updateCedearTransaction(tx.id, values)
            toast.success('Operación actualizada.')
            setOpen(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
