import type { Metadata } from 'next'
import NewPesosMovement from '@/features/pesos/components/NewPesosMovement'
import { DolarOption } from '@/types/dolar.types'

export const metadata: Metadata = {
  title: 'Nuevo movimiento de pesos',
}

type SearchParams = Promise<{ modo?: string; dolar?: string }>

const isDolarOption = (value: string | undefined): value is DolarOption =>
  Object.values(DolarOption).includes(value as DolarOption)

/** `?modo=conversion&dolar=<tipo>`: atajo "Comprar con pesos" desde `/dolar` */
export default async function NewPesosMovementPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { modo, dolar } = await searchParams
  return (
    <NewPesosMovement
      initialMode={modo === 'conversion' ? 'conversion' : 'movement'}
      dolarOption={isDolarOption(dolar) ? dolar : undefined}
    />
  )
}
