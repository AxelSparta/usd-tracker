import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

/**
 * false en SSR / hidratación, true en el cliente. Para contenido que depende de
 * `localStorage` (stores con `persist`): evita el mismatch de hidratación.
 */
export const useMounted = () =>
  useSyncExternalStore(subscribe, () => true, () => false)
