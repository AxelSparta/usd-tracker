'use client'

import { useState, type ReactNode } from 'react'
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
import { useCryptoStore } from '../crypto.store'
import CryptoTransactionForm from './CryptoTransactionForm'

export type NewCryptoMode = 'trade' | 'swap'

type NewCryptoTransactionProps = {
  /**
   * Formulario de intercambio: lo arma `app/` (puede mover también los USDT del dólar cripto,
   * `features/usdt-swaps`, que este módulo no importa)
   */
  swapForm: ReactNode
  initialMode?: NewCryptoMode
}

const modes: { value: NewCryptoMode; label: string }[] = [
  { value: 'trade', label: 'Compra / venta' },
  { value: 'swap', label: 'Intercambio' },
]

export default function NewCryptoTransaction({
  swapForm,
  initialMode = 'trade',
}: NewCryptoTransactionProps) {
  const router = useRouter()
  const [mode, setMode] = useState<NewCryptoMode>(initialMode)
  const addTransaction = useCryptoStore((s) => s.addTransaction)

  return (
    <div className='mx-auto w-full max-w-md'>
      <Card className='shadow-none'>
        <CardHeader>
          <CardTitle>
            <h1 className='text-lg tracking-tight'>Nueva operación</h1>
          </CardTitle>
          <CardDescription>
            {mode === 'trade'
              ? 'Registrá una compra o venta de cripto en dólares.'
              : 'Registrá el cambio de una cripto por otra (BTC → ETH) o por tus USDT del dólar cripto.'}
          </CardDescription>
          <div
            role='group'
            aria-label='Tipo de operación'
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
          {mode === 'trade' ? (
            <CryptoTransactionForm
              submitLabel='Guardar operación'
              onSubmit={async (tx, coin) => {
                await addTransaction(tx, coin)
                toast.success('Operación registrada.')
                router.push('/cripto')
              }}
            />
          ) : (
            swapForm
          )}
        </CardContent>
      </Card>
    </div>
  )
}
