import type { Metadata } from 'next'
import CedearDetail from '@/features/cedears/components/CedearDetail'

export const metadata: Metadata = {
  title: 'Detalle de CEDEAR',
}

export default async function CedearPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params
  return <CedearDetail ticker={decodeURIComponent(ticker).toUpperCase()} />
}
