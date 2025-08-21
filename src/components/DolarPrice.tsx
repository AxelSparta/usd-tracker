'use client'

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
    if (!dolarData) {
      console.log(dolarData)
      setDolarOption(DolarOption.Cripto)
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDolarOption(e.target.value as DolarOption)
  }

  return (
    <section className='flex flex-col items-center gap-2 p-2'>
      <p className='font-bold'>Dolar: {dolarData?.nombre}</p>
      <select
        onChange={handleChange}
        defaultValue={dolarOption}
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
