import type { Metadata } from 'next'
import NewTransactionForm from '@/components/NewTransactionForm'

export const metadata: Metadata = {
  title: 'Nueva transacción',
}

export default function NewTransactionPage() {
  return <NewTransactionForm />
}
