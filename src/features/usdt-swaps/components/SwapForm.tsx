'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format, isToday } from 'date-fns'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { fetchCoinPrices } from '@/features/crypto/api'
import CoinCombobox from '@/features/crypto/components/CoinCombobox'
import { useCryptoStore } from '@/features/crypto/crypto.store'
import { useCryptoPricesStore } from '@/features/crypto/prices.store'
import type { Coin } from '@/features/crypto/types'
import {
  formatAmountArInput,
  formatCurrency,
  formatPrice,
  numberToArInput,
  parseLocaleAmount,
} from '@/lib/locale-amount'
import { useDolarStore } from '@/store/dolar.store'
import { useTransactionsData } from '@/store/transaction.store'
import { DolarOption } from '@/types/dolar.types'
import { addUsdtSwap } from '../actions'
import { TETHER_COIN_ID, usdtMoved, type UsdtSwapDirection, type UsdtSwapInput } from '../operations'
import { fetchCriptoHistory, rateOn, type DolarHistoryPoint } from '../rates'
import { swapFormSchema, USDT_OPTION_ID, type SwapFormInput } from '../validations'

/** Los USDT del dólar cripto, como opción del selector de monedas */
const USDT_COIN: Coin = { id: USDT_OPTION_ID, symbol: 'USDT', name: 'Dólar cripto', image: null }

type SwapFormProps = {
  /** `usdt`: abre con los USDT del dólar cripto como lo que se entrega (atajo desde `/dolar`) */
  defaultFrom?: 'usdt'
}

type AmountFieldName = 'fromQuantity' | 'toQuantity' | 'valueUsd' | 'arsRate' | 'fee'

/**
 * Intercambio cripto ↔ cripto (venta + compra enlazadas, módulo cripto) o USDT ↔ cripto
 * (pata en el dólar cripto + pata en el módulo cripto, `features/usdt-swaps`).
 */
export default function SwapForm({ defaultFrom }: SwapFormProps) {
  const router = useRouter()
  const addSwap = useCryptoStore((s) => s.addSwap)
  const hasTether = useCryptoStore((s) => Boolean(s.coins[TETHER_COIN_ID]))
  const usdtBalance = useTransactionsData()[DolarOption.Cripto]?.totalUsd ?? 0
  const criptoQuote = useDolarStore((s) => s.allDolarData?.[DolarOption.Cripto])

  const [fromCoin, setFromCoin] = useState<Coin | null>(defaultFrom === 'usdt' ? USDT_COIN : null)
  const [toCoin, setToCoin] = useState<Coin | null>(null)
  const [loadingValue, setLoadingValue] = useState(false)
  const [history, setHistory] = useState<DolarHistoryPoint[] | null>(null)
  const [rateNote, setRateNote] = useState<string | null>(null)
  // Último valor autocompletado: si el usuario lo cambia a mano, no se pisa
  const autoRate = useRef<string>('')

  const form = useForm<SwapFormInput>({
    resolver: zodResolver(swapFormSchema),
    defaultValues: {
      fromCoinId: defaultFrom === 'usdt' ? USDT_OPTION_ID : '',
      fromQuantity: '',
      toCoinId: '',
      toQuantity: '',
      valueUsd: '',
      arsRate: '',
      fee: '',
      feeCurrency: 'USDT',
      date: new Date(),
    },
  })

  const [fromQuantity, toQuantity, valueUsd, fee, feeCurrency, date] = useWatch({
    control: form.control,
    name: ['fromQuantity', 'toQuantity', 'valueUsd', 'fee', 'feeCurrency', 'date'],
  })

  const direction: UsdtSwapDirection | null =
    fromCoin?.id === USDT_OPTION_ID ? 'USDT_TO_COIN' : toCoin?.id === USDT_OPTION_ID ? 'COIN_TO_USDT' : null
  const coin = direction === 'USDT_TO_COIN' ? toCoin : direction === 'COIN_TO_USDT' ? fromCoin : null

  // Cotización del dólar cripto del día: compra si se entregan USDT, venta si se reciben
  useEffect(() => {
    if (!direction || !date) return
    const current = form.getValues('arsRate')
    if (current && current !== autoRate.current) return

    const apply = (rate: number | null, note: string | null) => {
      const text = rate ? numberToArInput(rate) : ''
      autoRate.current = text
      form.setValue('arsRate', text, { shouldValidate: Boolean(text) })
      setRateNote(note)
    }
    const side = direction === 'USDT_TO_COIN' ? 'compra' : 'venta'
    if (isToday(date) && criptoQuote) {
      apply(criptoQuote[side], `Dólar cripto ${side} de hoy.`)
      return
    }
    if (!history) {
      let cancelled = false
      fetchCriptoHistory()
        .then((points) => !cancelled && setHistory(points))
        .catch(() => !cancelled && setRateNote('No se pudo obtener el histórico: ingresala a mano.'))
      return () => {
        cancelled = true
      }
    }
    const found = rateOn(history, date, direction)
    if (!found) {
      apply(null, 'No hay cotización para esa fecha: ingresala a mano.')
      return
    }
    const day = format(new Date(`${found.date}T12:00:00`), 'dd/MM/yyyy')
    apply(found.rate, `Dólar cripto ${side} del ${day}.`)
  }, [direction, date, history, criptoQuote, form])

  /** Cripto ↔ cripto: valor = cantidad entregada × precio actual de la moneda entregada */
  const fillCurrentValue = async (target: Coin) => {
    const quantity = parseLocaleAmount(form.getValues('fromQuantity'))
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error('Primero ingresá la cantidad que entregás.')
      return
    }
    setLoadingValue(true)
    try {
      const prices = await fetchCoinPrices([target.id])
      const price = prices[target.id]
      if (!price) throw new Error('CoinGecko no tiene precio para esta moneda.')
      useCryptoPricesStore.setState((s) => ({ prices: { ...s.prices, [target.id]: price } }))
      form.setValue('valueUsd', numberToArInput(Number((quantity * price.usd).toFixed(2))), {
        shouldValidate: true,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo obtener el precio.')
    } finally {
      setLoadingValue(false)
    }
  }

  const toUsdtSwap = (data: SwapFormInput, dir: UsdtSwapDirection, target: Coin): UsdtSwapInput => {
    const feeAmount = data.fee.trim() ? parseLocaleAmount(data.fee) : 0
    const toCoinSide = dir === 'USDT_TO_COIN'
    return {
      direction: dir,
      coin: target,
      quantity: parseLocaleAmount(toCoinSide ? data.toQuantity : data.fromQuantity),
      usdt: parseLocaleAmount(toCoinSide ? data.fromQuantity : data.toQuantity),
      ...(feeAmount > 0 && { fee: { amount: feeAmount, currency: data.feeCurrency } }),
      arsRate: parseLocaleAmount(data.arsRate),
      date: data.date,
    }
  }

  async function handleSubmit(data: SwapFormInput) {
    if (!fromCoin || !toCoin) return
    try {
      if (direction && coin) {
        await addUsdtSwap(toUsdtSwap(data, direction, coin))
      } else {
        await addSwap({
          from: fromCoin,
          fromQuantity: parseLocaleAmount(data.fromQuantity),
          to: toCoin,
          toQuantity: parseLocaleAmount(data.toQuantity),
          valueUsd: parseLocaleAmount(data.valueUsd),
          date: data.date,
        })
      }
      toast.success('Intercambio registrado.')
      router.push('/cripto')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Algo malió sal.')
    }
  }

  // Resumen: precio implícito y lo que se mueve en el dólar cripto
  const summary = (() => {
    if (!fromCoin || !toCoin) return null
    const from = parseLocaleAmount(fromQuantity)
    const to = parseLocaleAmount(toQuantity)
    if (!(from > 0) || !(to > 0)) return null
    if (direction && coin) {
      const feeAmount = fee.trim() ? parseLocaleAmount(fee) : 0
      const usdt = direction === 'USDT_TO_COIN' ? from : to
      const quantity = direction === 'USDT_TO_COIN' ? to : from
      const moved = usdtMoved({
        direction,
        usdt,
        fee: feeAmount > 0 ? { amount: feeAmount, currency: feeCurrency } : undefined,
      })
      const verb = direction === 'USDT_TO_COIN' ? 'Salen' : 'Entran'
      return `${coin.symbol} a US$${formatPrice(moved / quantity)} · ${verb} ${formatCurrency(moved)} USDT del dólar cripto`
    }
    const value = parseLocaleAmount(valueUsd)
    if (!(value > 0)) return null
    return `Venta de ${fromCoin.symbol} a US$${formatPrice(value / from)} · compra de ${toCoin.symbol} a US$${formatPrice(value / to)}`
  })()

  const pinned = [
    { coin: USDT_COIN, heading: 'Tus USDT', hint: `Saldo ${formatCurrency(usdtBalance)}` },
  ]

  const amountInput = (name: AmountFieldName, label: string, description?: React.ReactNode) => (
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
          {description && <FormDescription className='tabular-nums'>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )

  const coinField = (
    name: 'fromCoinId' | 'toCoinId',
    label: string,
    value: Coin | null,
    onChange: (coin: Coin) => void,
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={() => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <CoinCombobox
              value={value}
              pinned={pinned}
              onChange={(selected) => {
                onChange(selected)
                form.setValue(name, selected.id, { shouldValidate: true })
              }}
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
        {coinField('fromCoinId', 'Entregás', fromCoin, setFromCoin)}
        {amountInput('fromQuantity', `Cantidad${fromCoin ? ` de ${fromCoin.symbol}` : ''}`)}
        {coinField('toCoinId', 'Recibís', toCoin, setToCoin)}
        {amountInput('toQuantity', `Cantidad${toCoin ? ` de ${toCoin.symbol}` : ''}`)}

        {direction ? (
          <>
            {amountInput('arsRate', 'Cotización del dólar cripto (ARS)', rateNote)}
            <div className='grid grid-cols-[1fr_auto] items-start gap-2'>
              {amountInput('fee', 'Comisión (opcional)')}
              <FormField
                control={form.control}
                name='feeCurrency'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>En</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className='w-24'>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='USDT'>USDT</SelectItem>
                        <SelectItem value='COIN'>{coin?.symbol ?? 'Moneda'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>
            {hasTether && (
              <p className='text-xs text-muted-foreground'>
                Los USDT salen de tu dólar cripto, no de los USDT (Tether) cargados en Cripto.
              </p>
            )}
          </>
        ) : (
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
                <FormDescription>
                  Define el precio de venta de lo que entregás y el costo de lo que recibís.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {summary && <p className='text-sm tabular-nums text-muted-foreground'>{summary}</p>}

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
          Guardar intercambio
        </Button>
      </form>
    </Form>
  )
}
