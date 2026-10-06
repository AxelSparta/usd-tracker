import { createContext, useContext } from 'react'

/**
 * Las patas de una conversión pesos ↔ dólar se muestran en la lista del Dólar, pero borrarlas toca
 * los dos stores. El Dólar no importa `features/pesos` (D2): lo recibe por este contexto, que
 * provee `app/providers.tsx`.
 */
export type PesosConversionLinks = {
  /** Borra las dos patas (rechaza con `Error` en español, como las acciones de los stores) */
  remove: (conversionId: string) => Promise<void>
}

export const PesosConversionLinksContext = createContext<PesosConversionLinks>({
  remove: async () => {
    throw new Error('No se pudo eliminar la conversión.')
  },
})

export const usePesosConversionLinks = () => useContext(PesosConversionLinksContext)
