import type { Metadata } from 'next'
import CryptoTransactionForm from '@/features/crypto/components/CryptoTransactionForm'

export const metadata: Metadata = {
  title: 'Nueva operación cripto',
}

export default function NewCryptoTransactionPage() {
  return <CryptoTransactionForm />
}
