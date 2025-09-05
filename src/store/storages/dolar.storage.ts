import {
  createJSONStorage,
  StateStorage
} from 'zustand/middleware'

const storageApi: StateStorage = {
  getItem: function (name: string): string | null | Promise<string | null> {
    const dolarState = localStorage.getItem(name)
    if (dolarState) return dolarState
    return null
  },
  setItem: function (name: string, value: string): unknown | Promise<unknown> {
    localStorage.setItem(name, value)
    return true
  },
  removeItem: function (name: string): unknown | Promise<unknown> {
    localStorage.removeItem(name)
    return true
  }
}

export const dolarStorage = createJSONStorage(() => storageApi)
