'use client'

import { cn } from '@/lib/utils'

/** Botones de opción excluyente (rango, moneda, portafolio): una fila compacta */
export default function Segmented<T extends string>({
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
            'max-w-48 truncate rounded-[5px] px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground',
            option.value === value && 'bg-background text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
