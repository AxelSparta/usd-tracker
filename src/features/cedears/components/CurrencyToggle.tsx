'use client'

import { cn } from '@/lib/utils'
import type { ViewCurrency } from './format'

const options: { value: ViewCurrency; label: string }[] = [
  { value: 'USD', label: 'USD' },
  { value: 'ARS', label: 'ARS' },
]

/** Elige en qué moneda se ven las métricas; el PnL que importa en un CEDEAR es el de USD (D4) */
export default function CurrencyToggle({
  value,
  onChange,
}: {
  value: ViewCurrency
  onChange: (value: ViewCurrency) => void
}) {
  return (
    <div role='group' aria-label='Moneda' className='inline-flex gap-1 rounded-md border p-0.5'>
      {options.map((option) => (
        <button
          key={option.value}
          type='button'
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-sm px-2.5 py-1 text-xs transition-colors',
            value === option.value
              ? 'bg-muted font-medium text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
