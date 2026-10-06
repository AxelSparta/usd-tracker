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
import { usePesosStore } from '../pesos.store'
import PesosMovementForm from './PesosMovementForm'

export default function NewPesosMovement() {
  const addMovement = usePesosStore((s) => s.addMovement)
  const router = useRouter()

  return (
    <div className='mx-auto w-full max-w-md'>
      <Card className='shadow-none'>
        <CardHeader>
          <CardTitle>
            <h1 className='text-lg tracking-tight'>Nuevo movimiento</h1>
          </CardTitle>
          <CardDescription>Registrá un ingreso o un egreso de pesos.</CardDescription>
        </CardHeader>
        <CardContent>
          <PesosMovementForm
            submitLabel='Guardar movimiento'
            onSubmit={async (movement) => {
              await addMovement(movement)
              toast.success('Movimiento registrado.')
              router.push('/pesos')
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
