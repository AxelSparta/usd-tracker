import { createContext, useContext } from 'react'

/**
 * Las patas de una operación de CEDEAR (un movimiento de Pesos o una operación del Dólar CCL) se
 * muestran en las listas de esos módulos, que no importan `features/cedears` (D2): reciben por este
 * contexto qué operación es, para describirla y enlazarla. Lo provee `app/providers.tsx`.
 * Las patas no se editan ni se borran desde Pesos o el Dólar (D6).
 */
export type CedearLegInfo = {
  /** "Compra de 10 AAPL" */
  label: string
  /** Detalle del CEDEAR (`/cedears/AAPL`) */
  href: string
}

export type CedearLegs = {
  /** `null` si la operación todavía no cargó (o no existe) */
  describe: (cedearId: string) => CedearLegInfo | null
}

export const CedearLegsContext = createContext<CedearLegs>({ describe: () => null })

export const useCedearLegs = () => useContext(CedearLegsContext)
