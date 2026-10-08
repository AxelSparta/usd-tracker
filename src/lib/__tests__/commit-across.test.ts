import { describe, expect, it, vi } from 'vitest'
import { commitAcross, write } from '@/lib/synced-store'

/** Store mínimo con `applyExternal`: aplica al instante y revierte si falla la API */
const fakeStore = (initial: string) => {
  let state = initial
  const store = {
    value: () => state,
    getState: () => ({
      applyExternal: async (next: string, remote: () => Promise<unknown>) => {
        const previous = state
        state = next
        try {
          await remote()
        } catch (error) {
          state = previous
          throw error
        }
      },
    }),
  }
  return store
}

describe('commitAcross con tres stores (CEDEARs + Pesos + Dólar)', () => {
  it('aplica en los tres con un solo request', async () => {
    const stores = [fakeStore('a0'), fakeStore('b0'), fakeStore('c0')]
    const remote = vi.fn().mockResolvedValue(undefined)
    await commitAcross(
      stores.map((store, i) => write(store, `${'abc'[i]}1`)),
      remote,
    )
    expect(remote).toHaveBeenCalledTimes(1)
    expect(stores.map((s) => s.value())).toEqual(['a1', 'b1', 'c1'])
  })

  it('si falla el request, revierten los tres y relanza el error', async () => {
    const stores = [fakeStore('a0'), fakeStore('b0'), fakeStore('c0')]
    const remote = vi.fn().mockRejectedValue(new Error('No tenés pesos suficientes'))
    await expect(
      commitAcross(
        stores.map((store) => write(store, 'x')),
        remote,
      ),
    ).rejects.toThrow('No tenés pesos suficientes')
    expect(remote).toHaveBeenCalledTimes(1)
    expect(stores.map((s) => s.value())).toEqual(['a0', 'b0', 'c0'])
  })
})
