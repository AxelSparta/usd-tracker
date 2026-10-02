'use client'

import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { CalendarIcon, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  formatAmountArInput,
  formatPrice,
  formatQuantity,
  numberToArInput,
  parseLocaleAmount,
} from '@/lib/locale-amount'
import { TransactionType } from '@/types/transaction.types'
import { fetchCoinPrices } from '../api'
import { useCryptoPricesStore } from '../prices.store'
import type { Coin, CryptoTransaction } from '../types'
import {
  cryptoTransactionFormSchema,
  parseCryptoTransactionFormInput,
  type CryptoTransactionFormInput,
} from '../validations'
import CoinCombobox from './CoinCombobox'

type CryptoTransactionFormProps = {
  initialCoin?: Coin
  defaultValues?: Partial<CryptoTransactionFormInput>
  submitLabel: string
  /** Puede lanzar un `Error` de negocio: se muestra como toast y el form queda abierto */
  onSubmit: (tx: Omit<CryptoTransaction, 'id'>, coin: Coin) => void
}

/** Campos de una operación cripto; lo usan el alta y la edición. */
export default function CryptoTransactionForm({
  initialCoin,
  defaultValues,
  submitLabel,
  onSubmit,
}: CryptoTransactionFormProps) {
  const [coin, setCoin] = useState<Coin | null>(initialCoin ?? null)
  const [loadingPrice, setLoadingPrice] = useState(false)

  const form = useForm<CryptoTransactionFormInput>({
    resolver: zodResolver(cryptoTransactionFormSchema),
    defaultValues: {
      coinId: '',
      type: TransactionType.BUY,
      quantity: '',
      priceUsd: '',
      fee: '',
      feeCurrency: 'USD',
      date: new Date(),
      ...defaultValues,
    },
  })

  const [type, quantity, priceUsd, fee, feeCurrency] = useWatch({
    control: form.control,
    name: ['type', 'quantity', 'priceUsd', 'fee', 'feeCurrency'],
  })
  const total = parseLocaleAmount(quantity) * parseLocaleAmount(priceUsd)
  const feeAmount = fee.trim() ? parseLocaleAmount(fee) : 0
  const isBuy = type === TransactionType.BUY
  // Lo que efectivamente sale o entra, ya con la comisión
  const feeSummary =
    !Number.isFinite(feeAmount) || feeAmount <= 0
      ? null
      : feeCurrency === 'USD'
        ? `${isBuy ? 'Pagás' : 'Cobrás'} US$${formatPrice(isBuy ? total + feeAmount : total - feeAmount)} con la comisión`
        : `${isBuy ? 'Recibís' : 'Entregás'} ${formatQuantity(
            parseLocaleAmount(quantity) + (isBuy ? -feeAmount : feeAmount),
          )} ${coin?.symbol ?? ''} con la comisión`

  const fillCurrentPrice = async (target: Coin) => {
    setLoadingPrice(true)
    try {
      const prices = await fetchCoinPrices([target.id])
      const price = prices[target.id]
      if (!price) throw new Error('CoinGecko no tiene precio para esta moneda.')
      // Aprovechamos la consulta para el store de precios
      useCryptoPricesStore.setState((s) => ({
        prices: { ...s.prices, [target.id]: price },
      }))
      form.setValue('priceUsd', numberToArInput(price.usd), { shouldValidate: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo obtener el precio.')
    } finally {
      setLoadingPrice(false)
    }
  }

  const handleCoinChange = (selected: Coin) => {
    setCoin(selected)
    form.setValue('coinId', selected.id, { shouldValidate: true })
    if (!form.getValues('priceUsd')) fillCurrentPrice(selected)
  }

  function handleSubmit(data: CryptoTransactionFormInput) {
    if (!coin) return
    try {
      onSubmit(parseCryptoTransactionFormInput(data), coin)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Algo malió sal.')
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className='space-y-4'>
        <FormField
          control={form.control}
          name='coinId'
          render={() => (
            <FormItem>
              <FormLabel>Moneda</FormLabel>
              <FormControl>
                <CoinCombobox value={coin} onChange={handleCoinChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='type'
          render={({ field }) => (
            <FormItem className='space-y-3'>
              <FormLabel>Operación</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value}
                  className='flex gap-6'
                >
                  <FormItem className='flex items-center gap-3'>
                    <FormControl>
                      <RadioGroupItem value={TransactionType.BUY} />
                    </FormControl>
                    <FormLabel className='font-normal'>Compra</FormLabel>
                  </FormItem>
                  <FormItem className='flex items-center gap-3'>
                    <FormControl>
                      <RadioGroupItem value={TransactionType.SELL} />
                    </FormControl>
                    <FormLabel className='font-normal'>Venta</FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='quantity'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cantidad{coin ? ` de ${coin.symbol}` : ''}</FormLabel>
              <FormControl>
                <Input
                  type='text'
                  inputMode='decimal'
                  autoComplete='off'
                  placeholder='0'
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  value={field.value}
                  onChange={(e) =>
                    field.onChange(formatAmountArInput(e.target.value))
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='priceUsd'
          render={({ field }) => (
            <FormItem>
              <div className='flex items-center justify-between'>
                <FormLabel>Precio unitario (USD)</FormLabel>
                {coin && (
                  <Button
                    type='button'
                    variant='link'
                    size='sm'
                    className='h-auto p-0 text-xs'
                    disabled={loadingPrice}
                    onClick={() => fillCurrentPrice(coin)}
                  >
                    {loadingPrice && <Loader2 className='animate-spin' />}
                    Usar precio actual
                  </Button>
                )}
              </div>
              <FormControl>
                <Input
                  type='text'
                  inputMode='decimal'
                  autoComplete='off'
                  placeholder='0'
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  value={field.value}
                  onChange={(e) =>
                    field.onChange(formatAmountArInput(e.target.value))
                  }
                />
              </FormControl>
              {Number.isFinite(total) && total > 0 && (
                <FormDescription className='tabular-nums'>
                  Total: US${formatPrice(total)}
                  {coin && ` por ${formatQuantity(parseLocaleAmount(quantity))} ${coin.symbol}`}
                </FormDescription>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
        <div className='grid grid-cols-[1fr_auto] items-start gap-2'>
          <FormField
            control={form.control}
            name='fee'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Comisión (opcional)</FormLabel>
                <FormControl>
                  <Input
                    type='text'
                    inputMode='decimal'
                    autoComplete='off'
                    placeholder='0'
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={field.value}
                    onChange={(e) =>
                      field.onChange(formatAmountArInput(e.target.value))
                    }
                  />
                </FormControl>
                {feeSummary && Number.isFinite(total) && total > 0 && (
                  <FormDescription className='tabular-nums'>{feeSummary}</FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='feeCurrency'
            render={({ field }) => (
              <FormItem>
                <FormLabel>En</FormLabel>
                <Select
                  onValueChange={(value) => {
                    field.onChange(value)
                    form.trigger('fee')
                  }}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger className='w-24'>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value='USD'>USD</SelectItem>
                    <SelectItem value='COIN'>{coin?.symbol ?? 'Moneda'}</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name='date'
          render={({ field }) => (
            <FormItem className='flex flex-col'>
              <FormLabel>Fecha</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant='outline'
                      className='w-[240px] pl-3 text-left font-normal'
                    >
                      {field.value ? (
                        format(field.value, 'dd/MM/yyyy')
                      ) : (
                        <span>Seleccionar fecha</span>
                      )}
                      <CalendarIcon className='ml-auto h-4 w-4 opacity-50' />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className='w-auto p-0' align='start'>
                  <Calendar
                    mode='single'
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) =>
                      date > new Date() || date < new Date('2009-01-03')
                    }
                    captionLayout='dropdown'
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type='submit' className='w-full'>
          {submitLabel}
        </Button>
      </form>
    </Form>
  )
}
