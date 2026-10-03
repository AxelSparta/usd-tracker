'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useTransactionStore } from '@/store/transaction.store'
import TransactionForm from './TransactionForm'

export default function NewTransactionForm() {
  const addTransaction = useTransactionStore((state) => state.addTransaction)
  const router = useRouter()

  return (
    <div className='mx-auto w-full max-w-md'>
      <Card className='shadow-none'>
        <CardHeader>
          <CardTitle>
            <h1 className='text-lg tracking-tight'>Nueva transacción</h1>
          </CardTitle>
          <CardDescription>
            Registrá una compra o venta de dólares.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TransactionForm
            submitLabel='Guardar transacción'
            onSubmit={async (tx) => {
              await addTransaction(tx)
              toast.success('Transacción creada con éxito.')
              router.push('/dolar')
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
