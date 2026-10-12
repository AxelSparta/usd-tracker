import { cedearName } from '@/features/cedears/catalog'
import type { CedearPosition } from '@/features/cedears/types'
import type { CryptoPosition } from '@/features/crypto/types'
import type { DolarOption } from '@/types/dolar.types'
import type { TransactionsDataMap } from '@/types/transaction.types'

/**
 * Vista unificada del portfolio (Fase 5): suma los módulos sin mezclar sus métricas.
 *
 * - La composición se mide en **USD**: un dólar en mano vale 1 USD, una cripto vale su
 *   valor de mercado en USD, los pesos valen saldo / dólar MEP venta (Fase 8, D3) y un CEDEAR,
 *   su valor en pesos / CCL venta (Fase 10, D5). Así el reparto no depende de cotizaciones en
 *   pesos, salvo para pasar los pesos y los CEDEARs a USD.
 * - Los valores en ARS usan la cotización de cada tipo de dólar (módulo dólar, como en
 *   `/dolar`), el dólar cripto compra (módulo cripto, como en `/cripto`), el saldo (pesos) y
 *   precio × cantidad (CEDEARs).
 * - Las ganancias quedan en la moneda de cada módulo (ARS para dólar, USD para cripto y
 *   CEDEARs); Pesos no tiene (`pnl: null`).
 */

export type PortfolioModule = 'dolar' | 'crypto' | 'pesos' | 'cedears'

export type AssetAllocation = {
  /** Único entre módulos: `dolar:blue`, `crypto:bitcoin` */
  key: string
  module: PortfolioModule
  label: string
  /** Símbolo de la moneda (cripto) o ticker (CEDEARs) */
  symbol: string | null
  image: string | null
  /** Drill-down al detalle del activo */
  href: string
  valueUsd: number
  /** `null` si falta la cotización para pasarlo a pesos */
  valueArs: number | null
  /** Variación 24 h en % (cripto) o del día (CEDEARs) */
  change24h: number | null
  /** Parte del total en USD, 0–1 */
  share: number
}

export type ModuleSummary = {
  valueUsd: number
  valueArs: number | null
  /** Ganancia realizada + no realizada, en la moneda del módulo; `null` si no aplica (Pesos) */
  pnl: number | null
  /** Parte del total en USD, 0–1 */
  share: number
  assets: number
}

export type PortfolioOverview = {
  totalUsd: number
  /** `null` si algún activo no se pudo pasar a pesos */
  totalArs: number | null
  dolar: ModuleSummary
  /** `pnl` en USD */
  crypto: ModuleSummary
  /** `pnl` siempre `null`: un saldo no tiene ganancia */
  pesos: ModuleSummary
  /** `pnl` en USD (el que importa en un activo dolarizado, D4) */
  cedears: ModuleSummary
  /** Ordenados de mayor a menor valor */
  assets: AssetAllocation[]
  /** Monedas en cartera sin precio de mercado (no suman al valor); "Pesos" sin cotización MEP */
  missingPrices: string[]
}

type OverviewInput = {
  dolarData: TransactionsDataMap
  dolarLabel: (option: DolarOption) => string
  cryptoPositions: CryptoPosition[]
  /** Dólar cripto compra; `null` si todavía no hay cotización */
  cryptoArsRate: number | null
  /** Saldo del módulo Pesos (ARS) */
  pesosBalance?: number
  /** Dólar MEP venta: pasa los pesos a USD; `null` si todavía no hay cotización */
  mepRate?: number | null
  /** Posiciones de CEDEARs, ya valuadas en ARS y en USD (CCL venta) por `computeCedearPositions` */
  cedearPositions?: CedearPosition[]
}

/** Activo único del módulo Pesos */
export const PESOS_ASSET_KEY = 'pesos:ars'

// Restos de coma flotante en pesos (medio centavo)
const PESOS_DUST = 0.005

const sumOrNull = (values: (number | null)[]) =>
  values.some((v) => v === null)
    ? null
    : values.reduce<number>((acc, v) => acc + (v ?? 0), 0)

export const computePortfolioOverview = ({
  dolarData,
  dolarLabel,
  cryptoPositions,
  cryptoArsRate,
  pesosBalance = 0,
  mepRate = null,
  cedearPositions = [],
}: OverviewInput): PortfolioOverview => {
  const assets: Omit<AssetAllocation, 'share'>[] = []
  let dolarPnl = 0
  let cryptoPnl = 0
  let cedearsPnl = 0
  const missingPrices: string[] = []

  for (const [option, data] of Object.entries(dolarData) as [
    DolarOption,
    NonNullable<TransactionsDataMap[DolarOption]>,
  ][]) {
    dolarPnl += data.realizedProfit + data.unrealizedProfit
    if (data.totalUsd <= 0) continue
    assets.push({
      key: `dolar:${option}`,
      module: 'dolar',
      label: dolarLabel(option),
      symbol: null,
      image: null,
      href: '/dolar',
      valueUsd: data.totalUsd,
      valueArs: data.marketValuePesos,
      change24h: null,
    })
  }

  for (const position of cryptoPositions) {
    cryptoPnl += position.realizedPnlUsd + (position.unrealizedPnlUsd ?? 0)
    if (position.quantity <= 0) continue
    if (position.marketValueUsd === null) {
      missingPrices.push(position.coin.symbol)
      continue
    }
    assets.push({
      key: `crypto:${position.coin.id}`,
      module: 'crypto',
      label: position.coin.name,
      symbol: position.coin.symbol,
      image: position.coin.image,
      href: `/cripto/${position.coin.id}`,
      valueUsd: position.marketValueUsd,
      valueArs: cryptoArsRate === null ? null : position.marketValueUsd * cryptoArsRate,
      change24h: position.change24h,
    })
  }

  if (pesosBalance > PESOS_DUST) {
    if (mepRate) {
      assets.push({
        key: PESOS_ASSET_KEY,
        module: 'pesos',
        label: 'Pesos',
        symbol: null,
        image: null,
        href: '/pesos',
        valueUsd: pesosBalance / mepRate,
        valueArs: pesosBalance,
        change24h: null,
      })
    } else {
      missingPrices.push('Pesos (sin dólar MEP)')
    }
  }

  for (const position of cedearPositions) {
    cedearsPnl += position.realizedPnlUsd + (position.unrealizedPnlUsd ?? 0)
    if (position.quantity <= 0) continue
    // Sin precio o sin CCL no hay valor en USD: no entra a la composición (D5, nunca inventado)
    if (position.marketValueUsd === null) {
      missingPrices.push(
        position.marketValueArs === null ? position.ticker : `${position.ticker} (sin CCL)`,
      )
      continue
    }
    assets.push({
      key: `cedear:${position.ticker}`,
      module: 'cedears',
      label: cedearName(position.ticker) ?? position.ticker,
      symbol: position.ticker,
      image: null,
      href: `/cedears/${encodeURIComponent(position.ticker)}`,
      valueUsd: position.marketValueUsd,
      valueArs: position.marketValueArs,
      change24h: position.change24h,
    })
  }

  return finalize(
    assets,
    { dolar: dolarPnl, crypto: cryptoPnl, cedears: cedearsPnl },
    missingPrices,
  )
}

type ModulePnl = { dolar: number; crypto: number; cedears: number }

/** Participaciones, orden por valor y resumen por módulo */
const finalize = (
  assets: Omit<AssetAllocation, 'share'>[],
  pnl: ModulePnl,
  missingPrices: string[],
): PortfolioOverview => {
  const totalUsd = assets.reduce((acc, a) => acc + a.valueUsd, 0)
  const share = (value: number) => (totalUsd > 0 ? value / totalUsd : 0)
  const withShare = assets
    .map((a) => ({ ...a, share: share(a.valueUsd) }))
    .sort((a, b) => b.valueUsd - a.valueUsd)

  const summarize = (module: PortfolioModule, pnl: number | null): ModuleSummary => {
    const own = withShare.filter((a) => a.module === module)
    const valueUsd = own.reduce((acc, a) => acc + a.valueUsd, 0)
    return {
      valueUsd,
      valueArs: sumOrNull(own.map((a) => a.valueArs)),
      pnl,
      share: share(valueUsd),
      assets: own.length,
    }
  }

  return {
    totalUsd,
    totalArs: sumOrNull(withShare.map((a) => a.valueArs)),
    dolar: summarize('dolar', pnl.dolar),
    crypto: summarize('crypto', pnl.crypto),
    pesos: summarize('pesos', null),
    cedears: summarize('cedears', pnl.cedears),
    assets: withShare,
    missingPrices,
  }
}

/**
 * Vista "Todos": suma los resúmenes de cada portafolio. Cada uno se calcula por separado (su costo
 * promedio y su ganancia realizada no dependen de lo que pasó en otro portafolio) y acá solo se
 * suman valores y ganancias; un mismo activo en varios portafolios queda en una sola fila.
 */
export const combinePortfolioOverviews = (overviews: PortfolioOverview[]): PortfolioOverview => {
  if (overviews.length === 1) return overviews[0]
  const byKey = new Map<string, Omit<AssetAllocation, 'share'>>()
  for (const { share: _share, ...asset } of overviews.flatMap((o) => o.assets)) {
    const seen = byKey.get(asset.key)
    byKey.set(
      asset.key,
      seen
        ? {
            ...seen,
            valueUsd: seen.valueUsd + asset.valueUsd,
            valueArs: sumOrNull([seen.valueArs, asset.valueArs]),
          }
        : asset,
    )
  }
  const sumPnl = (module: keyof ModulePnl) =>
    overviews.reduce((acc, o) => acc + (o[module].pnl ?? 0), 0)
  return finalize(
    [...byKey.values()],
    { dolar: sumPnl('dolar'), crypto: sumPnl('crypto'), cedears: sumPnl('cedears') },
    [...new Set(overviews.flatMap((o) => o.missingPrices))],
  )
}

/** Hasta `max` segmentos (en orden de valor): los primeros `max − 1` activos y el resto en "Otros" */
export type AllocationSegment = {
  key: string
  label: string
  valueUsd: number
  share: number
  /** Índice del color categórico; `null` para "Otros" (gris) */
  colorIndex: number | null
}

export const toAllocationSegments = (
  assets: AssetAllocation[],
  max = 6,
): AllocationSegment[] => {
  const head = assets.length <= max ? assets : assets.slice(0, max - 1)
  const tail = assets.length <= max ? [] : assets.slice(max - 1)

  // El color sigue al activo, no a su puesto: si cambia el orden por precio, no se repinta
  const colorOf = new Map(
    [...head].sort((a, b) => a.key.localeCompare(b.key)).map((a, i) => [a.key, i]),
  )
  const segments = head.map((a) => ({
    key: a.key,
    label: a.label,
    valueUsd: a.valueUsd,
    share: a.share,
    colorIndex: colorOf.get(a.key)!,
  }))
  if (tail.length === 0) return segments

  return [
    ...segments,
    {
      key: 'others',
      label: `Otros (${tail.length})`,
      valueUsd: tail.reduce((acc, a) => acc + a.valueUsd, 0),
      share: tail.reduce((acc, a) => acc + a.share, 0),
      colorIndex: null,
    },
  ]
}
