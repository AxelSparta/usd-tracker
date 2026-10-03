import { useEffect, useState } from 'react'
import { format, isToday } from 'date-fns'
import { fetchCriptoHistory, rateOn, type DolarHistoryPoint, type QuoteSide } from '@/services/dolarHistory'
import { useDolarStore } from '@/store/dolar.store'
import { DolarOption } from '@/types/dolar.types'

export type CriptoRate = { rate: number | null; note: string | null }

const SIDE_LABEL: Record<QuoteSide, string> = { buy: 'compra', sell: 'venta' }

/**
 * Cotización del dólar cripto de un día: DolarAPI si es hoy, el histórico si es una fecha pasada
 * (el del día o el último anterior). `rate: null` con una nota si no hay dato: se carga a mano.
 * `side: null` = no hace falta (el form no pide cotización).
 */
export const useDolarCriptoRate = (side: QuoteSide | null, date: Date | undefined): CriptoRate => {
  const today = useDolarStore((s) => s.allDolarData?.[DolarOption.Cripto])
  const [history, setHistory] = useState<DolarHistoryPoint[] | null>(null)
  const [failed, setFailed] = useState(false)
  const needsHistory = Boolean(side && date && !(isToday(date) && today))

  useEffect(() => {
    if (!needsHistory || history || failed) return
    let cancelled = false
    fetchCriptoHistory()
      .then((points) => !cancelled && setHistory(points))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [needsHistory, history, failed])

  if (!side || !date) return { rate: null, note: null }
  const label = SIDE_LABEL[side]
  if (isToday(date) && today) {
    return { rate: side === 'buy' ? today.compra : today.venta, note: `Dólar cripto ${label} de hoy.` }
  }
  if (failed) return { rate: null, note: 'No se pudo obtener el histórico: ingresala a mano.' }
  if (!history) return { rate: null, note: null }
  const found = rateOn(history, date, side)
  if (!found) return { rate: null, note: 'No hay cotización para esa fecha: ingresala a mano.' }
  const day = format(new Date(`${found.date}T12:00:00`), 'dd/MM/yyyy')
  return { rate: found.rate, note: `Dólar cripto ${label} del ${day}.` }
}
