import type { Metadata } from 'next'
import CryptoCoinDetail from '@/features/crypto/components/CryptoCoinDetail'

export const metadata: Metadata = {
  title: 'Detalle cripto',
}

export default async function CryptoCoinPage({
  params,
}: {
  params: Promise<{ coinId: string }>
}) {
  const { coinId } = await params
  return <CryptoCoinDetail coinId={decodeURIComponent(coinId)} />
}
