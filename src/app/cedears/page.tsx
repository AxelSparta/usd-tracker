import Link from 'next/link'
import { Plus } from 'lucide-react'
import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import CedearPortfolio from '@/features/cedears/components/CedearPortfolio'

export const metadata: Metadata = {
  title: 'CEDEARs',
}

export default function CedearsPage() {
  return (
    <div className='space-y-12'>
      <header className='flex flex-wrap items-end justify-between gap-4'>
        <div className='space-y-1'>
          <h1 className='text-2xl font-semibold tracking-tight'>CEDEARs</h1>
          <p className='text-sm text-muted-foreground'>
            Tus CEDEARs en pesos y en dólares, con precios de BYMA.
          </p>
        </div>
        <Button asChild size='sm'>
          <Link href='/cedears/nueva'>
            <Plus />
            Nueva operación
          </Link>
        </Button>
      </header>
      <CedearPortfolio />
    </div>
  )
}
