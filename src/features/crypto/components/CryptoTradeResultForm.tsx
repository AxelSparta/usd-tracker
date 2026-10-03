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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  formatAmountArInput,
  formatPrice,
  formatQuantity,
  numberToArInput,
  parseLocaleAmount,
} from '@/lib/locale-amount'
import { TransactionType } from '@/types/transaction.types'
import { fetchCoinPriceOn } from '../api'
import type { Coin, CryptoTransaction } from '../types'
import {
  cryptoTradeResultFormSchema,
  parseCryptoTradeResultFormInput,
  type CryptoTradeResultFormInput,
} from '../validations'

type CryptoTradeResultFormProps = {
  /** La moneda en la que se acreditó el resultado (se elige antes del form) */
  coin: Coin
  defaultValues?: Partial<CryptoTradeResultFormInput>
  submitLabel: string
  /** Puede lanzar un `Error` de negocio: se muestra como toast y el form queda abierto */
  onSubmit: (tx: Omit<CryptoTransaction, 'id'>, coin: Coin) => void | Promise<void>
}

/**
 * Resultado de un trade acreditado en una moneda (futuros, margin, bots): entran o salen
 * unidades sin compra ni venta de por medio. Lo usan el alta y la edición.
 */
export default function CryptoTradeResultForm({
  coin,
  defaultValues,
  submitLabel,
  onSubmit,
}: CryptoTradeResultFormProps) {
  const [loadingPrice, setLoadingPrice] = useState(false)
  const form = useForm<CryptoTradeResultFormInput>({
    resolver: zodResolver(cryptoTradeResultFormSchema),
    defaultValues: {
      type: TransactionType.BUY,
      quantity: '',
      priceUsd: '',
      note: '',
      date: new Date(),
      ...defaultValues,
    },
  })
  const [type, quantity, priceUsd] = useWatch({
    control: form.control,
    name: ['type', 'quantity', 'priceUsd'],
  })
  const isGain = type === TransactionType.BUY
  const value = parseLocaleAmount(quantity) * parseLocaleAmount(priceUsd)
  const summary =
    Number.isFinite(value) && value > 0
      ? isGain
        ? `Entran ${formatQuantity(parseLocaleAmount(quantity))} ${coin.symbol} con un costo de US$${formatPrice(value)}, que se suma a la ganancia realizada.`
        : `Salen ${formatQuantity(parseLocaleAmount(quantity))} ${coin.symbol} sin cobrar nada: se realiza su costo promedio como pérdida.`
      : null

  const fillPrice = async () => {
    setLoadingPrice(true)
    try {
      const price = await fetchCoinPriceOn(coin.id, form.getValues('date'))
      if (!price) throw new Error('No hay precio para esa fecha: ingresalo a mano.')
      form.setValue('priceUsd', numberToArInput(price), { shouldValidate: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo obtener el precio.')
    } finally {
      setLoadingPrice(false)
    }
  }

  async function handleSubmit(data: CryptoTradeResultFormInput) {
    try {
      await onSubmit(parseCryptoTradeResultFormInput(data, coin.id), coin)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Algo malió sal.')
    }
  }

  const amountInput = (name: 'quantity' | 'priceUsd', label: string) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <div className='flex items-center justify-between'>
            <FormLabel>{label}</FormLabel>
            {name === 'priceUsd' && (
              <Button
                type='button'
                variant='link'
                size='sm'
                className='h-auto p-0 text-xs'
                disabled={loadingPrice}
                onClick={fillPrice}
              >
                {loadingPrice && <Loader2 className='animate-spin' />}
                Usar precio del día
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
          name='type'
          render={({ field }) => (
            <FormItem className='space-y-3'>
              <FormLabel>Resultado</FormLabel>
              <FormControl>
                <RadioGroup onValueChange={field.onChange} value={field.value} className='flex gap-6'>
                  <FormItem className='flex items-center gap-3'>
                    <FormControl>
                      <RadioGroupItem value={TransactionType.BUY} />
                    </FormControl>
                    <FormLabel className='font-normal'>Ganancia</FormLabel>
                  </FormItem>
                  <FormItem className='flex items-center gap-3'>
                    <FormControl>
                      <RadioGroupItem value={TransactionType.SELL} />
                    </FormControl>
                    <FormLabel className='font-normal'>Pérdida</FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {amountInput('quantity', `Cantidad de ${coin.symbol}`)}
        {amountInput('priceUsd', `Precio de ${coin.symbol} ese día (USD)`)}
        {summary && <p className='text-sm tabular-nums text-muted-foreground'>{summary}</p>}
        <FormField
          control={form.control}
          name='note'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nota (opcional)</FormLabel>
              <FormControl>
                <Input placeholder='Grid bot, BTCUSDT long x10…' autoComplete='off' {...field} />
              </FormControl>
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
                    <Button variant='outline' className='w-[240px] pl-3 text-left font-normal'>
                      {field.value ? format(field.value, 'dd/MM/yyyy') : <span>Seleccionar fecha</span>}
                      <CalendarIcon className='ml-auto h-4 w-4 opacity-50' />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className='w-auto p-0' align='start'>
                  <Calendar
                    mode='single'
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(day) => day > new Date() || day < new Date('2009-01-03')}
                    captionLayout='dropdown'
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type='submit' className='w-full' disabled={form.formState.isSubmitting}>
          {submitLabel}
        </Button>
      </form>
    </Form>
  )
}
