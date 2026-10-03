'use client'

import Link from 'next/link'
import { ArrowLeftRight, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { formatPrice, formatQuantity } from '@/lib/locale-amount'
import { cn } from '@/lib/utils'
import { TransactionType } from '@/types/transaction.types'
import { useCryptoStore } from '../crypto.store'
import type { CryptoTransaction } from '../types'
import CoinIcon from './CoinIcon'
import EditCryptoTransactionDialog from './EditCryptoTransactionDialog'

type CryptoTransactionListProps = {
  /** Solo las operaciones de esta moneda (detalle por moneda) */
  coinId?: string
}

const feeLabel = (tx: CryptoTransaction, symbol: string) =>
  tx.fee?.currency === 'USD'
    ? `US$${formatPrice(tx.fee.amount)}`
    : `${formatQuantity(tx.fee?.amount)} ${symbol}`

export default function CryptoTransactionList({ coinId }: CryptoTransactionListProps) {
  const transactions = useCryptoStore((s) => s.transactions)
  const coins = useCryptoStore((s) => s.coins)
  const removeTransaction = useCryptoStore((s) => s.removeTransaction)

  const sorted = transactions
    .filter((tx) => !coinId || tx.coinId === coinId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  /** Moneda de la otra pata de un intercambio */
  const counterpart = (tx: CryptoTransaction) => {
    const other = transactions.find((t) => t.swapId === tx.swapId && t.id !== tx.id)
    return other ? (coins[other.coinId]?.symbol ?? other.coinId) : '—'
  }

  const handleDelete = async (id: string) => {
    try {
      await removeTransaction(id)
      toast.success('Operación eliminada.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar la operación')
    }
  }

  return (
    <section aria-labelledby='historial-cripto' className='space-y-4'>
      <h2 id='historial-cripto' className='text-sm font-medium text-muted-foreground'>
        Historial
      </h2>
      <div className='overflow-x-auto rounded-lg border'>
        <table className='min-w-full text-sm'>
          <thead className='border-b text-left text-xs text-muted-foreground'>
            <tr>
              <th className='px-4 py-3 font-medium'>Fecha</th>
              <th className='px-4 py-3 font-medium'>Moneda</th>
              <th className='px-4 py-3 font-medium'>Operación</th>
              <th className='px-4 py-3 text-right font-medium'>Cantidad</th>
              <th className='px-4 py-3 text-right font-medium'>Precio</th>
              <th className='px-4 py-3 text-right font-medium'>Total</th>
              <th className='px-4 py-3'>
                <span className='sr-only'>Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody className='divide-y tabular-nums'>
            {sorted.map((tx) => {
              const coin = coins[tx.coinId]
              const isBuy = tx.type === TransactionType.BUY
              const symbol = coin?.symbol ?? tx.coinId
              return (
                <tr key={tx.id} className='transition-colors hover:bg-muted/40'>
                  <td className='whitespace-nowrap px-4 py-3 text-muted-foreground'>
                    {new Date(tx.date).toLocaleDateString('es-AR')}
                  </td>
                  <td className='px-4 py-3'>
                    <Link
                      href={`/cripto/${encodeURIComponent(tx.coinId)}`}
                      className='flex items-center gap-2 hover:underline'
                    >
                      {coin && <CoinIcon coin={coin} size={16} />}
                      <span className='font-medium'>{symbol}</span>
                    </Link>
                  </td>
                  <td className='px-4 py-3'>
                    <span
                      className={cn(
                        'text-xs font-medium',
                        isBuy
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400',
                      )}
                    >
                      {isBuy ? 'Compra' : 'Venta'}
                    </span>
                    {tx.swapId && (
                      <span className='ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground'>
                        <ArrowLeftRight className='size-3' aria-hidden />
                        {isBuy ? 'desde' : 'por'} {counterpart(tx)}
                      </span>
                    )}
                  </td>
                  <td className='px-4 py-3 text-right'>{formatQuantity(tx.quantity)}</td>
                  <td className='px-4 py-3 text-right text-muted-foreground'>
                    US${formatPrice(tx.priceUsd)}
                  </td>
                  <td className='whitespace-nowrap px-4 py-3 text-right font-medium'>
                    US${formatPrice(tx.quantity * tx.priceUsd)}
                    {tx.fee && (
                      <span className='block text-xs font-normal text-muted-foreground'>
                        comisión {feeLabel(tx, symbol)}
                      </span>
                    )}
                  </td>
                  <td className='px-2 py-1'>
                    <div className='flex justify-end'>
                      {/* Un intercambio se edita como unidad: se borra y se vuelve a cargar */}
                      {!tx.swapId && <EditCryptoTransactionDialog tx={tx} coin={coin} />}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant='ghost'
                            size='icon'
                            className='size-8 text-muted-foreground hover:text-destructive'
                            aria-label='Eliminar operación'
                          >
                            <Trash2 />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align='end' className='w-56 p-3'>
                          <p className='mb-3 text-sm'>
                            {tx.swapId
                              ? '¿Eliminar el intercambio completo (venta y compra)?'
                              : '¿Eliminar esta operación?'}
                          </p>
                          <Button
                            className='w-full'
                            variant='destructive'
                            size='sm'
                            onClick={() => handleDelete(tx.id)}
                          >
                            Confirmar
                          </Button>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
