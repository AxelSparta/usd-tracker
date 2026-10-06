'use client'

import { PesosConversionLinksContext } from '@/hooks/use-pesos-conversion-links'
import { removeConversion } from '../actions'

const value = { remove: removeConversion }

/** Provee a la lista del Dólar lo que necesita de una conversión pesos ↔ dólar */
export default function PesosConversionLinksProvider({ children }: { children: React.ReactNode }) {
  return (
    <PesosConversionLinksContext.Provider value={value}>{children}</PesosConversionLinksContext.Provider>
  )
}
