import Link from 'next/link'
import { Banknote, DollarSign } from 'lucide-react'
import { pnlClass } from '@/components/Stat'
import CoinIcon from '@/features/crypto/components/CoinIcon'
import { formatCurrency, formatPercent } from '@/lib/locale-amount'
import { cn } from '@/lib/utils'
import type { AllocationSegment, AssetAllocation } from '../overview'
import { formatShare, seriesBg } from './colors'

type AssetTableProps = {
  assets: AssetAllocation[]
  segments: AllocationSegment[]
}

/** Leyenda + vista en tabla de la composición: cada fila lleva al detalle del activo */
export default function AssetTable({ assets, segments }: AssetTableProps) {
  // Los activos plegados en "Otros" llevan su gris
  const colorOf = new Map(segments.map((s) => [s.key, s.colorIndex]))

  return (
    <div className='overflow-x-auto rounded-lg border'>
      <table className='min-w-full text-sm'>
        <thead className='border-b text-left text-xs text-muted-foreground'>
          <tr>
            <th className='px-4 py-3 font-medium'>Activo</th>
            <th className='px-4 py-3 text-right font-medium'>Valor</th>
            <th className='hidden px-4 py-3 text-right font-medium sm:table-cell'>En pesos</th>
            <th className='px-4 py-3 text-right font-medium'>24 h</th>
            <th className='px-4 py-3 text-right font-medium'>Parte</th>
          </tr>
        </thead>
        <tbody className='divide-y tabular-nums'>
          {assets.map((asset) => (
            <tr key={asset.key} className='transition-colors hover:bg-muted/40'>
              <td className='px-4 py-3'>
                <Link href={asset.href} className='flex items-center gap-2 hover:underline'>
                  <span
                    aria-hidden
                    className={cn(
                      'size-2.5 shrink-0 rounded-[2px]',
                      seriesBg(colorOf.has(asset.key) ? colorOf.get(asset.key)! : null),
                    )}
                  />
                  {asset.module === 'crypto' ? (
                    <CoinIcon coin={{ symbol: asset.symbol ?? '?', image: asset.image }} size={18} />
                  ) : asset.module === 'pesos' ? (
                    <Banknote className='size-[18px] shrink-0 text-muted-foreground' />
                  ) : (
                    <DollarSign className='size-[18px] shrink-0 text-muted-foreground' />
                  )}
                  <span className='font-medium'>{asset.symbol ?? asset.label}</span>
                  {asset.symbol && (
                    <span className='hidden text-muted-foreground sm:inline'>{asset.label}</span>
                  )}
                </Link>
              </td>
              <td className='whitespace-nowrap px-4 py-3 text-right font-medium'>
                US${formatCurrency(asset.valueUsd)}
              </td>
              <td className='hidden whitespace-nowrap px-4 py-3 text-right text-muted-foreground sm:table-cell'>
                {asset.valueArs === null ? '—' : `$${formatCurrency(asset.valueArs)}`}
              </td>
              <td className='whitespace-nowrap px-4 py-3 text-right text-xs'>
                {asset.change24h === null ? (
                  <span className='text-muted-foreground'>—</span>
                ) : (
                  <span className={pnlClass(asset.change24h)}>{formatPercent(asset.change24h)}</span>
                )}
              </td>
              <td className='px-4 py-3 text-right'>{formatShare(asset.share)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
