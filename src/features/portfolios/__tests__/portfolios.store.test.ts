import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TransactionType } from '@/types/transaction.types'

// `localStorage` en memoria antes de crear los stores (`persist` lo toma al crearse)
const storage = vi.hoisted(() => {
  const items = new Map<string, string>()
  const memory = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
    clear: () => items.clear(),
    key: (i: number) => [...items.keys()][i] ?? null,
    get length() {
      return items.size
    },
  }
  Object.defineProperty(globalThis, 'localStorage', { value: memory, configurable: true })
  // `persist` usa `window.localStorage`
  Object.defineProperty(globalThis, 'window', { value: { localStorage: memory }, configurable: true })
  return { items }
})

const { usePortfoliosStore } = await import('@/features/portfolios/portfolios.store')
const { DATA_STORES, readLocalPortfolio } = await import('@/features/portfolios/data-stores')
const { usePesosStore } = await import('@/features/pesos/pesos.store')
const { getCloudPortfolioId } = await import('@/lib/portfolio-scope')

const portfolios = () => usePortfoliosStore.getState()
const movement = (amount: number) => ({
  type: TransactionType.BUY,
  amount,
  date: '2026-01-01T03:00:00.000Z',
})
const balance = () => usePesosStore.getState().movements.map((m) => m.amount)

/** Como `CloudSync` sin sesión */
const goLocal = async () => {
  for (const { store } of DATA_STORES) {
    ;(store.getState() as { disconnectCloud: () => void }).disconnectCloud()
  }
  await portfolios().connectLocal()
}

beforeEach(async () => {
  storage.items.clear()
  usePortfoliosStore.setState({
    local: { portfolios: [{ id: 'principal', name: 'Principal' }], activeId: 'principal' },
    others: {},
  })
  await goLocal()
  usePesosStore.setState({ movements: [] })
})

describe('portafolios locales', () => {
  it('cada portafolio guarda sus datos en sus propias claves', async () => {
    await usePesosStore.getState().addMovement(movement(100))

    await portfolios().create('Ahorro')
    const ahorro = portfolios().local.activeId
    expect(ahorro).not.toBe('principal')
    // Recién creado: vacío, aunque el principal tenga datos
    expect(balance()).toEqual([])
    await usePesosStore.getState().addMovement(movement(5))

    // El principal sigue usando la clave de siempre (datos de antes de los portafolios)
    expect(JSON.parse(storage.items.get('pesos-storage')!).state.movements).toHaveLength(1)
    expect(JSON.parse(storage.items.get(`pesos-storage:${ahorro}`)!).state.movements).toHaveLength(1)

    await portfolios().select('principal')
    expect(balance()).toEqual([100])
    expect(readLocalPortfolio(ahorro).pesos.map((m) => m.amount)).toEqual([5])
  })

  it('borrar el activo pasa a otro y elimina sus claves; el último no se borra', async () => {
    await portfolios().create('Temporal')
    const temporal = portfolios().local.activeId
    await usePesosStore.getState().addMovement(movement(5))

    await portfolios().remove(temporal)
    expect(portfolios().local).toEqual({
      portfolios: [{ id: 'principal', name: 'Principal' }],
      activeId: 'principal',
    })
    expect(storage.items.has(`pesos-storage:${temporal}`)).toBe(false)
    await expect(portfolios().remove('principal')).rejects.toThrow(
      'No podés borrar tu único portafolio.',
    )
  })

  it('renombra y valida el nombre', async () => {
    await portfolios().rename('principal', '  Mi plata ')
    expect(portfolios().local.portfolios[0].name).toBe('Mi plata')
    await expect(portfolios().create('   ')).rejects.toThrow('Poné un nombre.')
  })
})

describe('portafolios en la nube', () => {
  const A = '00000000-0000-4000-8000-000000000a01'
  const B = '00000000-0000-4000-8000-000000000b01'

  it('recuerda el activo por usuario y manda su id en cada request', async () => {
    const seen: (string | null)[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        seen.push(new Headers(init?.headers).get('x-portfolio-id'))
        const body = url.startsWith('/api/portfolios')
          ? [
              { id: A, name: 'Principal' },
              { id: B, name: 'Trading' },
            ]
          : url.includes('dolar')
            ? []
            : url.includes('crypto')
              ? { transactions: [], coins: {} }
              : url.includes('pesos')
                ? { movements: [] }
                : { transactions: [] }
        return new Response(JSON.stringify(body), { status: 200 })
      }),
    )
    usePortfoliosStore.setState({ cloudActiveByUser: { user_a: B } })

    await portfolios().connectCloud('user_a')
    expect(portfolios().cloud.activeId).toBe(B)
    expect(getCloudPortfolioId()).toBe(B)

    seen.length = 0
    await portfolios().select(A)
    expect(portfolios().cloudActiveByUser.user_a).toBe(A)
    // Los cuatro stores se recargan con el portafolio nuevo
    expect(seen).toEqual([A, A, A, A])

    // Sin sesión, nada de header
    await goLocal()
    expect(getCloudPortfolioId()).toBeNull()
    vi.unstubAllGlobals()
  })
})
