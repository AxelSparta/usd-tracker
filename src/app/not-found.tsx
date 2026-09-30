import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className='flex flex-1 flex-col items-center justify-center gap-4 py-20 text-center'>
      <p className='text-sm text-muted-foreground'>404</p>
      <h1 className='text-2xl font-semibold tracking-tight'>
        Página no encontrada
      </h1>
      <Button asChild variant='outline' size='sm'>
        <Link href='/'>Volver al inicio</Link>
      </Button>
    </div>
  )
}
