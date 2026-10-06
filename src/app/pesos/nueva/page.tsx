import type { Metadata } from 'next'
import NewPesosMovement from '@/features/pesos/components/NewPesosMovement'

export const metadata: Metadata = {
  title: 'Nuevo movimiento de pesos',
}

export default function NewPesosMovementPage() {
  return <NewPesosMovement />
}
