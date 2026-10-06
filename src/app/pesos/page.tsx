import Link from 'next/link'
import { Plus } from 'lucide-react'
import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import PesosOverview from '@/features/pesos/components/PesosOverview'

export const metadata: Metadata = {
  title: 'Pesos',
}

export default function PesosPage() {
  return (
    <div className='space-y-12'>
      <header className='flex flex-wrap items-end justify-between gap-4'>
        <div className='space-y-1'>
          <h1 className='text-2xl font-semibold tracking-tight'>Pesos</h1>
          <p className='text-sm text-muted-foreground'>
            Tu saldo en pesos y su equivalente en dólares al MEP.
          </p>
        </div>
        <Button asChild size='sm'>
          <Link href='/pesos/nueva'>
            <Plus />
            Nuevo movimiento
          </Link>
        </Button>
      </header>
      <PesosOverview />
    </div>
  )
}
