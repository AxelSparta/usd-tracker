import { useEffect, useState } from 'react'
import { format, isToday } from 'date-fns'
import { fetchDolarHistory, rateOn, type DolarHistoryPoint, type QuoteSide } from '@/services/dolarHistory'
import { useDolarStore } from '@/store/dolar.store'
import { DolarOption } from '@/types/dolar.types'

export type DolarRate = { rate: number | null; note: string | null }

const SIDE_LABEL: Record<QuoteSide, string> = { buy: 'compra', sell: 'venta' }

/** "Dólar blue", "Dólar MEP", "Dólar cripto" */
const RATE_NAME: Record<DolarOption, string> = {
  [DolarOption.Oficial]: 'Dólar oficial',
  [DolarOption.Blue]: 'Dólar blue',
  [DolarOption.Bolsa]: 'Dólar MEP',
  [DolarOption.ContadoConLiqui]: 'Dólar CCL',
  [DolarOption.Tarjeta]: 'Dólar tarjeta',
  [DolarOption.Mayorista]: 'Dólar mayorista',
  [DolarOption.Cripto]: 'Dólar cripto',
}

/**
 * Cotización de un tipo de dólar en un día: DolarAPI si es hoy, el histórico si es una fecha pasada
 * (el del día o el último anterior). `rate: null` con una nota si no hay dato: se carga a mano.
 * `side: null` = no hace falta (el form no pide cotización).
 */
export const useDolarRate = (
  option: DolarOption,
  side: QuoteSide | null,
  date: Date | undefined,
): DolarRate => {
  const today = useDolarStore((s) => s.allDolarData?.[option])
  // El histórico se guarda con su tipo de dólar: al cambiar de tipo se vuelve a pedir
  const [history, setHistory] = useState<{ option: DolarOption; points: DolarHistoryPoint[] } | null>(null)
  const [failed, setFailed] = useState<DolarOption | null>(null)
  const needsHistory = Boolean(side && date && !(isToday(date) && today))
  const points = history?.option === option ? history.points : null

  useEffect(() => {
    if (!needsHistory || points || failed === option) return
    let cancelled = false
    fetchDolarHistory(option)
      .then((loaded) => !cancelled && setHistory({ option, points: loaded }))
      .catch(() => !cancelled && setFailed(option))
    return () => {
      cancelled = true
    }
  }, [needsHistory, points, failed, option])

  if (!side || !date) return { rate: null, note: null }
  const name = `${RATE_NAME[option]} ${SIDE_LABEL[side]}`
  if (isToday(date) && today) {
    return { rate: side === 'buy' ? today.compra : today.venta, note: `${name} de hoy.` }
  }
  if (failed === option) return { rate: null, note: 'No se pudo obtener el histórico: ingresala a mano.' }
  if (!points) return { rate: null, note: null }
  const found = rateOn(points, date, side)
  if (!found) return { rate: null, note: 'No hay cotización para esa fecha: ingresala a mano.' }
  const day = format(new Date(`${found.date}T12:00:00`), 'dd/MM/yyyy')
  return { rate: found.rate, note: `${name} del ${day}.` }
}
