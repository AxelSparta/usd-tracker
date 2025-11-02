'use client'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { useDolarStore } from '@/store/dolar.store'
import { DolarOption } from '@/types/dolar.types'
import dayjs from 'dayjs'
import { useEffect } from 'react'

export default function DolarPrice () {
  const dolarData = useDolarStore(state => state.dolarData)
  const setDolarOption = useDolarStore(state => state.setDolarOption)
  const dolarOption = useDolarStore(state => state.dolarOption)
  const dolarValues = Object.values(DolarOption)

  useEffect(() => {
    if (dolarOption) {
      setDolarOption(dolarOption)
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDolarOption(e.target.value as DolarOption)
  }

  return (
    <section className=''>
      <Card className='max-w-md mx-auto shadow-xl bg-gray-700'>
        <CardHeader>
          <CardTitle>Dolar: {dolarData?.nombre}</CardTitle>
          <CardDescription>
            Última fecha de actualización:{' '}
            {dayjs(dolarData?.fechaActualizacion).format('DD/MM/YYYY')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <select
            onChange={handleChange}
            value={dolarOption}
            className='border rounded px-2 py-1 cursor-pointer border-gray-300'
          >
            <option value="" className='dark:bg-gray-800'>Seleccionar dolar</option>
            {dolarValues.map(option => (
              <option key={option} value={option} className='dark:bg-gray-800'>
                Dolar {option}
              </option>
            ))}
          </select>
        </CardContent>
        <CardFooter>
          <div>
            <p>Precio compra: ${dolarData?.compra}</p>
            <p>Precio venta: ${dolarData?.venta}</p>
          </div>
        </CardFooter>
      </Card>
    </section>
  )
}
