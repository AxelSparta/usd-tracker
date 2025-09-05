'use client'

import { useDolarStore } from '@/store/dolar.store'
import { DolarOption } from '@/types/dolar.types'
import dayjs from 'dayjs'
import { useEffect } from 'react'

export default function DolarPrice () {
  const dolarData = useDolarStore(state => state.dolarData)
  const setDolarOption = useDolarStore(state => state.setDolarOption)
  const fetchDolarData = useDolarStore(state => state.fetchDolarData)
  const dolarOption = useDolarStore(state => state.dolarOption)
  const dolarValues = Object.values(DolarOption)

  useEffect(() => {
    // Si no hay datos cargados, se carga la opción por defecto
    if (!dolarData) {
      fetchDolarData(dolarOption ?? DolarOption.Cripto)
    }
  }, [dolarData, dolarOption, fetchDolarData])

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDolarOption(e.target.value as DolarOption)
  }

  if (!dolarData) {
    return <p className='text-center'>Cargando precio del dolar...</p>
  }

  return (
    <section className='flex flex-col items-center gap-2 p-2'>
      <p className='font-bold'>Dolar: {dolarData?.nombre}</p>
      <select
        onChange={handleChange}
        value={dolarOption}
        className='border rounded px-2 py-1 cursor-pointer border-gray-300'
      >
        {dolarValues.map(option => (
          <option key={option} value={option} className='dark:bg-gray-800'>
            Dolar {option}
          </option>
        ))}
      </select>
      <p>Compra: ${dolarData?.compra}</p>
      <p>Venta: ${dolarData?.venta}</p>
      <p className='text-sm'>
        Última fecha de actualización:{' '}
        {dayjs(dolarData?.fechaActualizacion).format('DD/MM/YYYY')}
      </p>
    </section>
  )
}
