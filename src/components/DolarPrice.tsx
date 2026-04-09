'use client'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { useDolarStore } from '@/store/dolar.store'
import { DolarOption } from '@/types/dolar.types'
import dayjs from 'dayjs'

export default function DolarPrice () {
  const allDolarData = useDolarStore(state => state.allDolarData)

  if (!allDolarData) {
    return (
      <section className="text-center p-4">
        <p className="animate-pulse">Cargando precios...</p>
      </section>
    )
  }

  // Mostramos los dólares más comunes
  const displayOptions = [
    DolarOption.Oficial,
    DolarOption.Blue,
    DolarOption.Bolsa,
    DolarOption.Cripto
  ]

  return (
    <section className="p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
        {displayOptions.map(option => {
          const data = allDolarData[option]
          if (!data) return null
          
          return (
            <Card key={option} className='shadow-md dark:bg-slate-800'>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Dólar {data.nombre}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {dayjs(data.fechaActualizacion).format('DD/MM/YYYY HH:mm')}
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Compra</p>
                    <p className="text-xl font-bold">${data.compra}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase text-muted-foreground">Venta</p>
                    <p className="text-xl font-bold text-green-600 dark:text-green-400">
                      ${data.venta}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
