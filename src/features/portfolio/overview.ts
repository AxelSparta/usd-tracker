import type { CryptoPosition } from '@/features/crypto/types'
import type { DolarOption } from '@/types/dolar.types'
import type { TransactionsDataMap } from '@/types/transaction.types'

/**
 * Vista unificada del portfolio (Fase 5): suma los módulos sin mezclar sus métricas.
 *
 * - La composición se mide en **USD**: un dólar en mano vale 1 USD, una cripto vale su
 *   valor de mercado en USD y los pesos valen saldo / dólar MEP venta (Fase 8, D3). Así el
 *   reparto no depende de cotizaciones en pesos, salvo para pasar los pesos a USD.
 * - Los valores en ARS usan la cotización de cada tipo de dólar (módulo dólar, como en
 *   `/dolar`), el dólar cripto compra (módulo cripto, como en `/cripto`) y el saldo (pesos).
 * - Las ganancias quedan en la moneda de cada módulo (ARS para dólar, USD para cripto);
 *   Pesos no tiene (`pnl: null`).
 */

export type PortfolioModule = 'dolar' | 'crypto' | 'pesos'

export type AssetAllocation = {
  /** Único entre módulos: `dolar:blue`, `crypto:bitcoin` */
  key: string
  module: PortfolioModule
  label: string
  /** Símbolo de la moneda (solo cripto) */
  symbol: string | null
  image: string | null
  /** Drill-down al detalle del activo */
  href: string
  valueUsd: number
  /** `null` si falta la cotización para pasarlo a pesos */
  valueArs: number | null
  /** Variación 24 h en % (solo cripto) */
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
}: OverviewInput): PortfolioOverview => {
  const assets: Omit<AssetAllocation, 'share'>[] = []
  let dolarPnl = 0
  let cryptoPnl = 0
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
    dolar: summarize('dolar', dolarPnl),
    crypto: summarize('crypto', cryptoPnl),
    pesos: summarize('pesos', null),
    assets: withShare,
    missingPrices,
  }
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
