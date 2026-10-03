'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/locale-amount'
import { cn } from '@/lib/utils'
import type { AllocationSegment } from '../overview'
import { formatShare, seriesBg } from './colors'

/**
 * Composición del portfolio como una barra apilada al 100 % (parte de un todo).
 * Spec dataviz: 24 px de alto, 2 px de separación con el color de la superficie,
 * extremo final redondeado. Cada segmento es foco/hover y muestra su valor en un
 * tooltip; la tabla de abajo es la leyenda y la vista accesible de los mismos datos.
 */
export default function AllocationBar({ segments }: { segments: AllocationSegment[] }) {
  const [active, setActive] = useState<string | null>(null)

  // Centro de cada segmento (0–1) para ubicar el tooltip
  const placed = segments.map((segment, i) => ({
    ...segment,
    center:
      segments.slice(0, i).reduce((acc, s) => acc + s.share, 0) + segment.share / 2,
  }))
  const current = placed.find((s) => s.key === active)

  return (
    <div className='relative pt-1'>
      <div
        role='img'
        aria-label={`Composición: ${segments
          .map((s) => `${s.label} ${formatShare(s.share)}`)
          .join(', ')}`}
        className='flex h-6 w-full gap-[2px]'
      >
        {placed.map((segment, i) => (
          <div
            key={segment.key}
            tabIndex={0}
            aria-label={`${segment.label}: US$${formatCurrency(segment.valueUsd)} (${formatShare(segment.share)})`}
            onPointerEnter={() => setActive(segment.key)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(segment.key)}
            onBlur={() => setActive(null)}
            style={{ flexGrow: segment.share, flexBasis: 0 }}
            className={cn(
              'h-full min-w-[2px] cursor-default outline-none transition-[filter,opacity] focus-visible:ring-2 focus-visible:ring-ring',
              seriesBg(segment.colorIndex),
              i === placed.length - 1 && 'rounded-r-[4px]',
              active && active !== segment.key && 'opacity-60',
            )}
          />
        ))}
      </div>

      {current && (
        <div
          role='tooltip'
          style={{ left: `clamp(4.5rem, ${current.center * 100}%, calc(100% - 4.5rem))` }}
          className='pointer-events-none absolute bottom-full z-10 mb-2 w-36 -translate-x-1/2 rounded-md border bg-popover px-3 py-2 text-xs'
        >
          <p className='text-sm font-semibold tabular-nums text-popover-foreground'>
            US${formatCurrency(current.valueUsd)}
          </p>
          <p className='flex items-center gap-1.5 text-muted-foreground'>
            <span className={cn('h-0.5 w-3 shrink-0 rounded-full', seriesBg(current.colorIndex))} />
            <span className='truncate'>{current.label}</span>
            <span className='ml-auto tabular-nums'>{formatShare(current.share)}</span>
          </p>
        </div>
      )}
    </div>
  )
}
