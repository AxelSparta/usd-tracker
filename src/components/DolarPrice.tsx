'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/locale-amount'
import { useDolarStore } from '@/store/dolar.store'
import { DolarOption } from '@/types/dolar.types'
import dayjs from 'dayjs'

// Mostramos los dólares más comunes
const displayOptions = [
  DolarOption.Oficial,
  DolarOption.Blue,
  DolarOption.Bolsa,
  DolarOption.Cripto
]

export default function DolarPrice () {
  const allDolarData = useDolarStore(state => state.allDolarData)

  return (
    <section aria-labelledby='cotizaciones' className='space-y-4'>
      <h2 id='cotizaciones' className='text-sm font-medium text-muted-foreground'>
        Cotizaciones
      </h2>
      <div className='grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-4'>
        {displayOptions.map(option => {
          const data = allDolarData?.[option]

          if (!allDolarData) {
            return (
              <div key={option} className='space-y-3 bg-card p-4'>
                <Skeleton className='h-4 w-16' />
                <Skeleton className='h-7 w-24' />
                <Skeleton className='h-3 w-20' />
              </div>
            )
          }
          if (!data) return null

          return (
            <div key={option} className='space-y-1 bg-card p-4'>
              <p className='text-sm text-muted-foreground'>{data.nombre}</p>
              <p className='text-2xl font-semibold tabular-nums tracking-tight'>
                ${formatCurrency(data.venta)}
              </p>
              <p className='text-xs text-muted-foreground tabular-nums'>
                Compra ${formatCurrency(data.compra)}
                <span className='mx-1.5'>·</span>
                {dayjs(data.fechaActualizacion).format('DD/MM HH:mm')}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
