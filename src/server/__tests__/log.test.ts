import { afterEach, describe, expect, it, vi } from 'vitest'
import { logError, logEvent } from '@/server/log'

const lastLine = (spy: { mock: { calls: unknown[][] } }) =>
  JSON.parse(spy.mock.calls.at(-1)?.[0] as string) as Record<string, unknown>

afterEach(() => {
  vi.restoreAllMocks()
})

describe('log', () => {
  it('logEvent escribe una línea JSON con nivel, evento, hora y campos', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    logEvent('dolar.created', { userId: 'user_a', type: 'BUY' })
    expect(lastLine(info)).toEqual({
      level: 'info',
      event: 'dolar.created',
      time: expect.any(String),
      userId: 'user_a',
      type: 'BUY',
    })
  })

  it('logError incluye mensaje, nombre y stack del error', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    logError('api.unexpected', new TypeError('boom'), { path: '/api/x' })
    expect(lastLine(error)).toMatchObject({
      level: 'error',
      event: 'api.unexpected',
      error: 'boom',
      name: 'TypeError',
      stack: expect.stringContaining('boom'),
      path: '/api/x',
    })
  })

  it('logError acepta valores que no son Error', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    logError('request.error', 'texto')
    expect(lastLine(error)).toMatchObject({ error: 'texto' })
  })
})
