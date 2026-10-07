import { z } from 'zod'
import { baseRows, cedearName } from '@/features/cedears/catalog'
import type { CedearHistoryPoint } from '@/features/cedears/types'

/**
 * Cliente de data912 (precios de CEDEARs, pública y sin key). Solo se usa desde route handlers: el
 * Data Cache de Next comparte las respuestas entre usuarios y, si hace falta cambiar de fuente
 * (IOL, BYMA), el cliente no se entera. Se declara educativa/hobby y no es tiempo real.
 */

const BASE_URL = 'https://data912.com'

export class Data912Error extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

const data912Fetch = async (
  path: string,
  revalidate: number,
): Promise<{ body: unknown; date: string | null }> => {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { accept: 'application/json' },
    next: { revalidate },
  })
  if (!response.ok) {
    throw new Data912Error(`data912 respondió ${response.status}`, response.status)
  }
  // El Data Cache guarda los headers originales: `date` es cuándo data912 armó la respuesta
  return { body: await response.json(), date: response.headers.get('date') }
}

const panelSchema = z.array(
  z.object({
    symbol: z.string(),
    c: z.number(),
    pct_change: z.number().nullish(),
    v: z.number().nullish(),
  }),
)

export type CedearPanelRow = {
  ticker: string
  name: string | null
  /** `null` si el panel lo informa en 0 */
  priceArs: number | null
  change24h: number | null
  /** Volumen nominal del día (cantidad de CEDEARs) */
  volume: number
}

export type CedearPanel = {
  rows: CedearPanelRow[]
  /** Epoch en ms de cuándo data912 armó el panel; `null` si no lo informa */
  updatedAt: number | null
}

/** Panel de CEDEARs en ARS (sin las variantes en USD), cache de 5 min */
export const getCedearPanel = async (): Promise<CedearPanel> => {
  const { body, date } = await data912Fetch('/live/arg_cedears', 5 * 60)
  const updatedAt = date ? Date.parse(date) : NaN
  return {
    rows: baseRows(panelSchema.parse(body)).map((row) => ({
      ticker: row.symbol,
      name: cedearName(row.symbol),
      priceArs: row.c > 0 ? row.c : null,
      change24h: row.pct_change ?? null,
      volume: row.v ?? 0,
    })),
    updatedAt: Number.isNaN(updatedAt) ? null : updatedAt,
  }
}

const historySchema = z.array(
  z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    c: z.number(),
  }),
)

/** Un ticker sin histórico responde 200 con `{ "Error": "..." }`, no 404 */
const unknownTickerSchema = z.object({ Error: z.string() })

/**
 * Cierre diario en ARS (`date` = `yyyy-MM-dd`) desde `from` inclusive, ordenado por fecha; `null`
 * si data912 no tiene histórico de ese ticker (pasa con muchos CEDEARs, también populares). Sin
 * ajustar por cambios de ratio: el día que cambia, el precio salta.
 */
export const getCedearHistory = async (
  ticker: string,
  from: string,
): Promise<CedearHistoryPoint[] | null> => {
  // El pasado no cambia; solo se agrega la última rueda
  const { body } = await data912Fetch(
    `/historical/cedears/${encodeURIComponent(ticker)}`,
    6 * 60 * 60,
  )
  if (unknownTickerSchema.safeParse(body).success) return null
  return historySchema
    .parse(body)
    .filter((point) => point.date >= from && point.c > 0)
    .map((point) => ({ date: point.date, ars: point.c }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** Traduce errores de data912 a una respuesta JSON para los route handlers. */
export const data912ErrorResponse = (error: unknown): Response => {
  console.error('data912:', error)
  return Response.json(
    { error: 'No se pudo consultar el precio de los CEDEARs.' },
    { status: 502 },
  )
}
