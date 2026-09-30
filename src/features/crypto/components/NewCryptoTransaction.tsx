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
import { useCryptoStore } from '../crypto.store'
import CryptoTransactionForm from './CryptoTransactionForm'

export default function NewCryptoTransaction() {
  const router = useRouter()
  const addTransaction = useCryptoStore((s) => s.addTransaction)

  return (
    <div className='mx-auto w-full max-w-md'>
      <Card className='shadow-none'>
        <CardHeader>
          <CardTitle>
            <h1 className='text-lg tracking-tight'>Nueva operación</h1>
          </CardTitle>
          <CardDescription>
            Registrá una compra o venta de cripto en dólares.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CryptoTransactionForm
            submitLabel='Guardar operación'
            onSubmit={(tx, coin) => {
              addTransaction(tx, coin)
              toast.success('Operación registrada.')
              router.push('/cripto')
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
