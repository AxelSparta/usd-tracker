import Link from 'next/link'
import { Bitcoin } from 'lucide-react'
import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Cripto',
}

export default function CriptoPage() {
  return (
    <div className='flex flex-1 flex-col items-center justify-center gap-4 py-20 text-center'>
      <div className='flex size-12 items-center justify-center rounded-full border text-muted-foreground'>
        <Bitcoin className='size-5' />
      </div>
      <div className='space-y-1'>
        <h1 className='text-xl font-semibold tracking-tight'>Cripto tracker</h1>
        <p className='max-w-sm text-sm text-muted-foreground'>
          Estamos trabajando en esta sección. Pronto vas a poder registrar tus
          criptomonedas y seguir su rendimiento.
        </p>
      </div>
      <Button asChild variant='outline' size='sm'>
        <Link href='/dolar'>Ir al tracker de dólar</Link>
      </Button>
    </div>
  )
}
