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
import { TRADE_RESULT } from '@/types/transaction.types'
import type { Coin, CryptoTransaction } from '../types'
import CryptoTradeResultForm from './CryptoTradeResultForm'
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
  const isTrade = tx.kind === TRADE_RESULT

  const save = async (values: Omit<CryptoTransaction, 'id'>, selectedCoin: Coin) => {
    await updateTransaction(tx.id, values, selectedCoin)
    toast.success('Operación actualizada.')
    setOpen(false)
  }

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
          <DialogTitle>{isTrade ? 'Editar resultado de trade' : 'Editar operación'}</DialogTitle>
          <DialogDescription>
            Se revalida el saldo de la moneda en toda la línea temporal.
          </DialogDescription>
        </DialogHeader>
        {/* Radix desmonta el contenido al cerrar: cada apertura arranca con los valores actuales */}
        {isTrade ? (
          <CryptoTradeResultForm
            submitLabel='Guardar cambios'
            coin={coin ?? { id: tx.coinId, symbol: tx.coinId, name: tx.coinId, image: null }}
            defaultValues={{
              type: tx.type,
              quantity: numberToArInput(tx.quantity),
              priceUsd: numberToArInput(tx.priceUsd),
              note: tx.note ?? '',
              date: new Date(tx.date),
            }}
            onSubmit={save}
          />
        ) : (
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
            onSubmit={save}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
