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
import {
  formatAmountArInput,
  formatPrice,
  numberToArInput,
  parseLocaleAmount,
} from '@/lib/locale-amount'
import { fetchCoinPrices } from '../api'
import type { CryptoSwapInput } from '../crypto.store'
import { useCryptoPricesStore } from '../prices.store'
import type { Coin } from '../types'
import {
  cryptoSwapFormSchema,
  type CryptoSwapFormInput,
} from '../validations'
import CoinCombobox from './CoinCombobox'

type CryptoSwapFormProps = {
  /** Puede lanzar un `Error` de negocio: se muestra como toast y el form queda abierto */
  onSubmit: (swap: CryptoSwapInput) => void | Promise<void>
}

type AmountFieldName = 'fromQuantity' | 'toQuantity' | 'valueUsd'

/** Intercambio cripto ↔ cripto: se registra como una venta y una compra enlazadas. */
export default function CryptoSwapForm({ onSubmit }: CryptoSwapFormProps) {
  const [fromCoin, setFromCoin] = useState<Coin | null>(null)
  const [toCoin, setToCoin] = useState<Coin | null>(null)
  const [loadingValue, setLoadingValue] = useState(false)

  const form = useForm<CryptoSwapFormInput>({
    resolver: zodResolver(cryptoSwapFormSchema),
    defaultValues: {
      fromCoinId: '',
      fromQuantity: '',
      toCoinId: '',
      toQuantity: '',
      valueUsd: '',
      date: new Date(),
    },
  })

  const [fromQuantity, toQuantity, valueUsd] = useWatch({
    control: form.control,
    name: ['fromQuantity', 'toQuantity', 'valueUsd'],
  })
  const value = parseLocaleAmount(valueUsd)
  const fromPrice = value / parseLocaleAmount(fromQuantity)
  const toPrice = value / parseLocaleAmount(toQuantity)
  const showPrices =
    fromCoin && toCoin && Number.isFinite(fromPrice) && Number.isFinite(toPrice)

  /** Valor = cantidad entregada × precio actual de la moneda entregada */
  const fillCurrentValue = async (coin: Coin) => {
    const quantity = parseLocaleAmount(form.getValues('fromQuantity'))
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error('Primero ingresá la cantidad que entregás.')
      return
    }
    setLoadingValue(true)
    try {
      const prices = await fetchCoinPrices([coin.id])
      const price = prices[coin.id]
      if (!price) throw new Error('CoinGecko no tiene precio para esta moneda.')
      useCryptoPricesStore.setState((s) => ({
        prices: { ...s.prices, [coin.id]: price },
      }))
      form.setValue('valueUsd', numberToArInput(Number((quantity * price.usd).toFixed(2))), {
        shouldValidate: true,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo obtener el precio.')
    } finally {
      setLoadingValue(false)
    }
  }

  async function handleSubmit(data: CryptoSwapFormInput) {
    if (!fromCoin || !toCoin) return
    try {
      await onSubmit({
        from: fromCoin,
        fromQuantity: parseLocaleAmount(data.fromQuantity),
        to: toCoin,
        toQuantity: parseLocaleAmount(data.toQuantity),
        valueUsd: parseLocaleAmount(data.valueUsd),
        date: data.date,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Algo malió sal.')
    }
  }

  const amountInput = (name: AmountFieldName, label: string) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
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
              onChange={(e) => field.onChange(formatAmountArInput(e.target.value))}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className='space-y-4'>
        <FormField
          control={form.control}
          name='fromCoinId'
          render={() => (
            <FormItem>
              <FormLabel>Entregás</FormLabel>
              <FormControl>
                <CoinCombobox
                  value={fromCoin}
                  onChange={(coin) => {
                    setFromCoin(coin)
                    form.setValue('fromCoinId', coin.id, { shouldValidate: true })
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {amountInput('fromQuantity', `Cantidad${fromCoin ? ` de ${fromCoin.symbol}` : ''}`)}
        <FormField
          control={form.control}
          name='toCoinId'
          render={() => (
            <FormItem>
              <FormLabel>Recibís</FormLabel>
              <FormControl>
                <CoinCombobox
                  value={toCoin}
                  onChange={(coin) => {
                    setToCoin(coin)
                    form.setValue('toCoinId', coin.id, { shouldValidate: true })
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {amountInput('toQuantity', `Cantidad${toCoin ? ` de ${toCoin.symbol}` : ''}`)}
        <FormField
          control={form.control}
          name='valueUsd'
          render={({ field }) => (
            <FormItem>
              <div className='flex items-center justify-between'>
                <FormLabel>Valor del intercambio (USD)</FormLabel>
                {fromCoin && (
                  <Button
                    type='button'
                    variant='link'
                    size='sm'
                    className='h-auto p-0 text-xs'
                    disabled={loadingValue}
                    onClick={() => fillCurrentValue(fromCoin)}
                  >
                    {loadingValue && <Loader2 className='animate-spin' />}
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
                  onChange={(e) => field.onChange(formatAmountArInput(e.target.value))}
                />
              </FormControl>
              <FormDescription className='tabular-nums'>
                {showPrices
                  ? `Venta de ${fromCoin.symbol} a US$${formatPrice(fromPrice)} · compra de ${toCoin.symbol} a US$${formatPrice(toPrice)}`
                  : 'Define el precio de venta de lo que entregás y el costo de lo que recibís.'}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
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
        <Button type='submit' className='w-full' disabled={form.formState.isSubmitting}>
          Guardar intercambio
        </Button>
      </form>
    </Form>
  )
}
