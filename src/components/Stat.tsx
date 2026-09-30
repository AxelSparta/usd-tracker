import { cn } from '@/lib/utils'

type StatProps = {
  label: string
  value: string
  secondaryLabel: string
  secondaryValue: string
  valueClassName?: string
  secondaryClassName?: string
}

export function Stat({
  label,
  value,
  secondaryLabel,
  secondaryValue,
  valueClassName,
  secondaryClassName,
}: StatProps) {
  return (
    <div className='space-y-1 bg-card p-4'>
      <p className='text-sm text-muted-foreground'>{label}</p>
      <p
        className={cn(
          'text-xl font-semibold tabular-nums tracking-tight',
          valueClassName,
        )}
      >
        {value}
      </p>
      <p className='text-xs text-muted-foreground tabular-nums'>
        {secondaryLabel}{' '}
        <span className={cn('font-medium text-foreground', secondaryClassName)}>
          {secondaryValue}
        </span>
      </p>
    </div>
  )
}

export const pnlClass = (value: number) =>
  value >= 0
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400'
