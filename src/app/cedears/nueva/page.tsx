import type { Metadata } from 'next'
import NewCedearTransaction from '@/features/cedears/components/NewCedearTransaction'

export const metadata: Metadata = {
  title: 'Nueva operación de CEDEAR',
}

export default function NewCedearTransactionPage() {
  return <NewCedearTransaction />
}
