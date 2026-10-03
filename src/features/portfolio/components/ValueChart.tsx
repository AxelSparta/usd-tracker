'use client'

import { format, parse } from 'date-fns'
import { es } from 'date-fns/locale'
import { RotateCw } from 'lucide-react'
import { useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/locale-amount'
import { cn } from '@/lib/utils'
import { useValueHistory, type HistoryCurrency, type HistoryRange } from '../hooks'

const RANGES: HistoryRange[] = ['1M', '3M', '6M', '1A']
const CURRENCIES: { value: HistoryCurrency; label: string }[] = [
  { value: 'ars', label: 'ARS' },
  { value: 'usd', label: 'USD' },
]

const toDate = (key: string) => parse(key, 'yyyy-MM-dd', new Date())
const compact = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 })
const money = (currency: HistoryCurrency, n: number) =>
  `${currency === 'usd' ? 'US$' : '$'}${formatCurrency(n)}`

/** Botones de opción excluyente (rango, moneda): una fila arriba del gráfico */
function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div role='radiogroup' aria-label={label} className='flex rounded-md bg-muted p-0.5'>
      {options.map((option) => (
        <button
          key={option.value}
          type='button'
          role='radio'
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-[5px] px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground',
            option.value === value && 'bg-background text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function ChartTooltip({
  active,
  payload,
  currency,
}: TooltipContentProps & { currency: HistoryCurrency }) {
  const point = payload?.[0]
  if (!active || !point || typeof point.value !== 'number') return null
  return (
    <div className='rounded-md border bg-popover px-3 py-2 text-xs'>
      <p className='text-sm font-semibold tabular-nums text-popover-foreground'>
        {money(currency, point.value)}
      </p>
      <p className='text-muted-foreground'>
        {format(toDate(point.payload.date), "EEEE d 'de' MMMM yyyy", { locale: es })}
      </p>
    </div>
  )
}

/**
 * Evolución del valor del portfolio (una serie: un solo eje). El valor incluye lo que
 * se compró y vendió en el período: no es solo rendimiento, y así se aclara.
 */
export default function ValueChart() {
  const [range, setRange] = useState<HistoryRange>('3M')
  const [currency, setCurrency] = useState<HistoryCurrency>('ars')
  const { points, gapUntil, status, error, retry } = useValueHistory(range, currency)

  const longRange = range === '6M' || range === '1A'
  // Rangos largos: una marca por mes (el 1°), para no repetir "nov 25, nov 25"
  const monthTicks = longRange
    ? points.filter((p) => p.date.endsWith('-01')).map((p) => p.date)
    : undefined

  return (
    <section aria-labelledby='evolucion' className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <h2 id='evolucion' className='text-sm font-medium text-muted-foreground'>
          Evolución del valor
        </h2>
        <div className='flex gap-2'>
          <Segmented
            label='Período'
            options={RANGES.map((r) => ({ value: r, label: r }))}
            value={range}
            onChange={setRange}
          />
          <Segmented label='Moneda' options={CURRENCIES} value={currency} onChange={setCurrency} />
        </div>
      </div>

      <div className='rounded-lg border bg-card p-4'>
        {status === 'loading' ? (
          <Skeleton className='h-60 w-full' />
        ) : status === 'error' ? (
          <div className='flex h-60 flex-col items-center justify-center gap-3 text-center'>
            <p className='text-sm text-muted-foreground'>{error}</p>
            <Button variant='outline' size='sm' onClick={retry}>
              <RotateCw />
              Reintentar
            </Button>
          </div>
        ) : points.length < 2 ? (
          <div className='flex h-60 items-center justify-center text-center text-sm text-muted-foreground'>
            Todavía no hay suficiente historia para graficar este período.
          </div>
        ) : (
          <div className='h-60' role='img' aria-label={`Evolución del valor en ${currency.toUpperCase()}, ${range}`}>
            <ResponsiveContainer width='100%' height='100%'>
              <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke='var(--border)' strokeWidth={1} />
                <XAxis
                  dataKey='date'
                  tickLine={false}
                  axisLine={false}
                  minTickGap={32}
                  ticks={monthTicks}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                  tickFormatter={(key: string) =>
                    format(toDate(key), longRange ? 'MMM yy' : 'd MMM', { locale: es })
                  }
                />
                <YAxis
                  width={56}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                  tickFormatter={(n: number) => compact.format(n)}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1 }}
                  content={(props) => <ChartTooltip {...props} currency={currency} />}
                />
                <Area
                  type='monotone'
                  dataKey={currency}
                  stroke='var(--chart-1)'
                  strokeWidth={2}
                  fill='var(--chart-1)'
                  fillOpacity={0.1}
                  dot={false}
                  activeDot={{ r: 4, fill: 'var(--chart-1)', stroke: 'var(--card)', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <p className='text-xs text-muted-foreground'>
        Incluye las compras y ventas del período: muestra cuánto valía tu portfolio cada día, no
        solo el rendimiento. Cotización de cada día (si no hubo, la anterior).
        {gapUntil &&
          ` Algún activo no tiene precio antes del ${format(toDate(gapUntil), 'dd/MM/yyyy')}: el gráfico arranca ahí.`}
      </p>
    </section>
  )
}
