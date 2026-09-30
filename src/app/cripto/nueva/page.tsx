import type { Metadata } from 'next'
import NewCryptoTransaction from '@/features/crypto/components/NewCryptoTransaction'

export const metadata: Metadata = {
  title: 'Nueva operación cripto',
}

export default function NewCryptoTransactionPage() {
  return <NewCryptoTransaction />
}
