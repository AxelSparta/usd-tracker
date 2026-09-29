import Link from 'next/link'

export default function NotFound() {
  return (
    <div className='flex flex-1 flex-col items-center justify-center gap-4 py-20'>
      <h1 className='text-4xl font-bold'>404 - Página no encontrada</h1>
      <Link className='underline hover:text-blue-500' href='/'>
        Volver al inicio
      </Link>
    </div>
  )
}
