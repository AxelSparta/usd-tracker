import Image from 'next/image'
import { cn } from '@/lib/utils'
import type { Coin } from '../types'

type CoinIconProps = {
  coin: Pick<Coin, 'symbol' | 'image'>
  size?: number
  className?: string
}

export default function CoinIcon({ coin, size = 20, className }: CoinIconProps) {
  if (!coin.image) {
    return (
      <span
        aria-hidden
        style={{ width: size, height: size }}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full border text-[10px] font-medium text-muted-foreground',
          className,
        )}
      >
        {coin.symbol.slice(0, 1)}
      </span>
    )
  }

  return (
    <Image
      src={coin.image}
      alt=''
      width={size}
      height={size}
      className={cn('shrink-0 rounded-full', className)}
    />
  )
}
