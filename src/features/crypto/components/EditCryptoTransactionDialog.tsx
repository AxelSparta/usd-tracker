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
import { useCryptoStore } from '../crypto.store'
import type { Coin, CryptoTransaction } from '../types'
import CryptoTransactionForm from './CryptoTransactionForm'

type EditCryptoTransactionDialogProps = {
  tx: CryptoTransaction
  coin: Coin | undefined
}

export default function EditCryptoTransactionDialog({
  tx,
  coin,
}: EditCryptoTransactionDialogProps) {
  const [open, setOpen] = useState(false)
  const updateTransaction = useCryptoStore((s) => s.updateTransaction)

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
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Editar operación</DialogTitle>
          <DialogDescription>
            Se revalida el saldo de la moneda en toda la línea temporal.
          </DialogDescription>
        </DialogHeader>
        {/* Radix desmonta el contenido al cerrar: cada apertura arranca con los valores actuales */}
        <CryptoTransactionForm
          submitLabel='Guardar cambios'
          initialCoin={coin}
          defaultValues={{
            coinId: tx.coinId,
            type: tx.type,
            quantity: numberToArInput(tx.quantity),
            priceUsd: numberToArInput(tx.priceUsd),
            fee: tx.fee ? numberToArInput(tx.fee.amount) : '',
            feeCurrency: tx.fee?.currency ?? 'USD',
            date: new Date(tx.date),
          }}
          onSubmit={(values, selectedCoin) => {
            updateTransaction(tx.id, values, selectedCoin)
            toast.success('Operación actualizada.')
            setOpen(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
