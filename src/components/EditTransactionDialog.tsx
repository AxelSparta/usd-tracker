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
import { useTransactionStore } from '@/store/transaction.store'
import { TRADE_RESULT, type Transaction } from '@/types/transaction.types'
import TradeResultForm from './TradeResultForm'
import TransactionForm from './TransactionForm'

export default function EditTransactionDialog({ tx }: { tx: Transaction }) {
  const [open, setOpen] = useState(false)
  const updateTransaction = useTransactionStore((s) => s.updateTransaction)
  const isTrade = tx.kind === TRADE_RESULT

  const save = async (values: Omit<Transaction, 'id'>) => {
    await updateTransaction(tx.id, values)
    toast.success('Transacción actualizada.')
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className='size-8 text-muted-foreground hover:text-foreground'
          aria-label='Editar transacción'
        >
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{isTrade ? 'Editar resultado de trade' : 'Editar transacción'}</DialogTitle>
          <DialogDescription>
            Se revalida el saldo de toda la línea temporal.
          </DialogDescription>
        </DialogHeader>
        {/* Radix desmonta el contenido al cerrar: cada apertura arranca con los valores actuales */}
        {isTrade ? (
          <TradeResultForm
            submitLabel='Guardar cambios'
            defaultValues={{
              type: tx.type,
              dollarsAmount: numberToArInput(tx.dollarsAmount),
              arsRate: numberToArInput(tx.pesosAmount / tx.dollarsAmount),
              note: tx.note ?? '',
              date: new Date(tx.date),
            }}
            onSubmit={save}
          />
        ) : (
          <TransactionForm
            submitLabel='Guardar cambios'
            defaultValues={{
              type: tx.type,
              dolarOption: tx.dolarOption,
              pesosAmount: numberToArInput(tx.pesosAmount),
              dollarsAmount: numberToArInput(tx.dollarsAmount),
              date: new Date(tx.date),
            }}
            onSubmit={save}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
