'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { addCedearTransaction } from '../actions'
import CedearTransactionForm from './CedearTransactionForm'

export default function NewCedearTransaction() {
  const router = useRouter()

  return (
    <div className='mx-auto w-full max-w-md'>
      <Card className='shadow-none'>
        <CardHeader>
          <CardTitle>
            <h1 className='text-lg tracking-tight'>Nueva operación de CEDEAR</h1>
          </CardTitle>
          <CardDescription>
            Comprá o vendé CEDEARs con tus pesos o tus dólares CCL: el saldo se actualiza solo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CedearTransactionForm
            submitLabel='Guardar operación'
            onSubmit={async (tx) => {
              await addCedearTransaction(tx)
              toast.success('Operación registrada.')
              router.push('/cedears')
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
