import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DolarData } from '@/types/dolar.types'

const toast = vi.hoisted(() => ({ error: vi.fn(), dismiss: vi.fn() }))
const api = vi.hoisted(() => ({ getAllDolars: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('@/services/dolarApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/dolarApi')>()),
  getAllDolars: api.getAllDolars,
}))

const { DolarApiError } = await import('@/services/dolarApi')
const { useDolarStore } = await import('@/store/dolar.store')

const blue: DolarData = {
  casa: 'blue',
  nombre: 'Blue',
  compra: 1500,
  venta: 1520,
  moneda: 'USD',
  fechaActualizacion: '2026-10-02T12:00:00Z',
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  useDolarStore.setState({ allDolarData: null })
})

describe('fetchAllDolars', () => {
  it('guarda las cotizaciones conocidas y cierra el aviso de error', async () => {
    api.getAllDolars.mockResolvedValue([blue, { ...blue, casa: 'euro' }])
    expect(await useDolarStore.getState().fetchAllDolars()).toBe(true)
    expect(Object.keys(useDolarStore.getState().allDolarData!)).toEqual(['blue'])
    expect(toast.dismiss).toHaveBeenCalledWith('dolar-fetch-error')
  })

  it('sin conexión: avisa y conserva las últimas cotizaciones', async () => {
    useDolarStore.setState({ allDolarData: { blue } as never })
    api.getAllDolars.mockRejectedValue(new DolarApiError('timeout', true))
    expect(await useDolarStore.getState().fetchAllDolars()).toBe(false)
    expect(toast.error).toHaveBeenCalledWith(
      'Sin conexión: no se pudieron actualizar las cotizaciones. Mostramos las últimas guardadas.',
      { id: 'dolar-fetch-error' },
    )
    expect(useDolarStore.getState().allDolarData?.blue).toEqual(blue)
  })

  it('DolarAPI caída (sin datos previos): mensaje distinto', async () => {
    api.getAllDolars.mockRejectedValue(new DolarApiError('DolarAPI respondió 503', false))
    await useDolarStore.getState().fetchAllDolars()
    expect(toast.error).toHaveBeenCalledWith(
      'DolarAPI no responde: reintentamos en unos segundos.',
      { id: 'dolar-fetch-error' },
    )
  })
})
