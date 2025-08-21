import {
	createJSONStorage,
	StateStorage
} from 'zustand/middleware'

const storageApi: StateStorage = {
  getItem: function (name: string): string | null | Promise<string | null> {
    throw new Error('Function not implemented.')
  },
  setItem: function (name: string, value: string): unknown | Promise<unknown> {
    throw new Error('Function not implemented.')
  },
  removeItem: function (name: string): unknown | Promise<unknown> {
    throw new Error('Function not implemented.')
  }
}

export const dolarStorage = createJSONStorage(() => storageApi)
