import { createContext, useContext } from 'react'

/**
 * Las patas de un intercambio USDT ↔ cripto se muestran en las listas de cada módulo, pero
 * borrarlas toca los dos stores. Los módulos no importan `features/usdt-swaps`: lo reciben por
 * este contexto, que provee `app/providers.tsx` (las páginas son de servidor y no pueden pasar
 * funciones por props).
 */
export type UsdtSwapLinks = {
  /** La otra pata vista desde el dólar, ej. "0,0012 BTC"; `null` si no se encuentra */
  cryptoSide: (usdtSwapId: string) => string | null
  /** Borra las dos patas (rechaza con `Error` en español, como las acciones de los stores) */
  remove: (usdtSwapId: string) => Promise<void>
}

export const UsdtSwapLinksContext = createContext<UsdtSwapLinks>({
  cryptoSide: () => null,
  remove: async () => {
    throw new Error('No se pudo eliminar el intercambio.')
  },
})

export const useUsdtSwapLinks = () => useContext(UsdtSwapLinksContext)
