import Link from 'next/link'
import { Plus } from 'lucide-react'
import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import CryptoPortfolio from '@/features/crypto/components/CryptoPortfolio'

export const metadata: Metadata = {
  title: 'Cripto',
}

export default function CriptoPage() {
  return (
    <div className='space-y-12'>
      <header className='flex flex-wrap items-end justify-between gap-4'>
        <div className='space-y-1'>
          <h1 className='text-2xl font-semibold tracking-tight'>Cripto</h1>
          <p className='text-sm text-muted-foreground'>
            Tu portfolio cripto en dólares, con precios de CoinGecko.
          </p>
        </div>
        <Button asChild size='sm'>
          <Link href='/cripto/nueva'>
            <Plus />
            Nueva operación
          </Link>
        </Button>
      </header>
      <CryptoPortfolio />
    </div>
  )
}
