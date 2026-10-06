import Link from 'next/link'
import { Banknote, Plus } from 'lucide-react'
import type { Metadata } from 'next'
import DolarPrice from '@/components/DolarPrice'
import TransactionList from '@/components/TransactionList'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Dólar',
}

export default function DolarPage() {
  return (
    <div className='space-y-12'>
      <header className='flex flex-wrap items-end justify-between gap-4'>
        <div className='space-y-1'>
          <h1 className='text-2xl font-semibold tracking-tight'>Dólar</h1>
          <p className='text-sm text-muted-foreground'>
            Cotizaciones y rendimiento de tus compras de USD.
          </p>
        </div>
        <div className='flex gap-2'>
          <Button asChild variant='outline' size='sm'>
            <Link href='/pesos/nueva?modo=conversion'>
              <Banknote />
              Comprar con pesos
            </Link>
          </Button>
          <Button asChild size='sm'>
            <Link href='/dolar/nueva'>
              <Plus />
              Nueva transacción
            </Link>
          </Button>
        </div>
      </header>
      <DolarPrice />
      <TransactionList />
    </div>
  )
}
