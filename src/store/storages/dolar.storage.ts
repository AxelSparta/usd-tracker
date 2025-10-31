import { createJSONStorage, StateStorage } from 'zustand/middleware'

// Safe no-op storage to use during SSR (when `window` / `localStorage` are not available).
const noopStorage: StateStorage = {
  getItem: (name: string) => null,
  setItem: (name: string, value: string) => undefined,
  removeItem: (name: string) => undefined
}

// Use localStorage in the browser, otherwise use noopStorage to avoid SSR errors.
export const dolarStorage = createJSONStorage(() => (typeof window === 'undefined' ? noopStorage : localStorage))
