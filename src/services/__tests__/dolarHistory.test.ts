import { describe, expect, it } from 'vitest'
import { rateOn } from '@/services/dolarHistory'

const points = [
  { date: '2026-02-02', buy: 1490, sell: 1510 },
  { date: '2026-02-03', buy: 1495, sell: 1515 },
  { date: '2026-02-06', buy: 1500, sell: 1520 },
]
const day = (iso: string) => new Date(`${iso}T15:00:00`)

describe('rateOn', () => {
  it('usa compra o venta según la punta', () => {
    expect(rateOn(points, day('2026-02-03'), 'buy')).toEqual({ rate: 1495, date: '2026-02-03' })
    expect(rateOn(points, day('2026-02-03'), 'sell')).toEqual({ rate: 1515, date: '2026-02-03' })
  })

  it('sin cotización ese día, usa la del último día anterior', () => {
    expect(rateOn(points, day('2026-02-05'), 'buy')).toEqual({ rate: 1495, date: '2026-02-03' })
  })

  it('null antes del histórico', () => {
    expect(rateOn(points, day('2026-01-15'), 'buy')).toBeNull()
    expect(rateOn([], day('2026-02-05'), 'buy')).toBeNull()
  })
})
