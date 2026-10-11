'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { computePesosBalance } from '@/features/pesos/operations'
import { usePesosStore } from '@/features/pesos/pesos.store'
import { useDolarRate } from '@/hooks/use-dolar-rate'
import { useMounted } from '@/hooks/use-mounted'
import {
  formatAmountArInput,
  formatCurrency,
  formatPrice,
  numberToArInput,
  parseLocaleAmount,
} from '@/lib/locale-amount'
import { useTransactionStore } from '@/store/transaction.store'
import { DolarOption } from '@/types/dolar.types'
import { TransactionType } from '@/types/transaction.types'
import { fetchCedearPriceOn } from '../api'
import { cedearTotal } from '../metrics'
import type { Cedear, CedearCurrency, CedearTransaction } from '../types'
import {
  cedearTransactionFormSchema,
  parseCedearTransactionFormInput,
  type CedearTransactionFormInput,
} from '../validations'
import CedearCombobox from './CedearCombobox'

type CedearTransactionFormProps = {
  initialCedear?: Cedear
  defaultValues?: Partial<CedearTransactionFormInput>
  submitLabel: string
  /** Puede lanzar un `Error` de negocio: se muestra como toast y el form queda abierto */
  onSubmit: (tx: Omit<CedearTransaction, 'id'>) => void | Promise<void>
}

const CCL = DolarOption.ContadoConLiqui

const money = (currency: CedearCurrency, amount: number) =>
  currency === 'ARS' ? `$${formatCurrency(amount)}` : `US$${formatCurrency(amount)}`

/**
 * Compra o venta de CEDEARs, pagada con pesos (pata en Pesos) o con dólares CCL (pata en el Dólar).
 * El CCL del día (D4) y el precio se autocompletan y se pueden editar. Lo usan el alta y la edición.
 */
export default function CedearTransactionForm({
  initialCedear,
  defaultValues,
  submitLabel,
  onSubmit,
}: CedearTransactionFormProps) {
  const [cedear, setCedear] = useState<Cedear | null>(initialCedear ?? null)
  const [loadingPrice, setLoadingPrice] = useState(false)
  // El CCL se completa solo hasta que el usuario lo edita (en la edición, ya viene cargado)
  const autoFxRate = useRef(!defaultValues?.fxRate)
  const movements = usePesosStore((s) => s.movements)
  const cclGroup = useTransactionStore((s) => s.transactions[CCL])

  // "Hoy" sale del reloj de cada lado: el server (UTC) puede estar en otro día que el navegador
  const mounted = useMounted()
  const form = useForm<CedearTransactionFormInput>({
    resolver: zodResolver(cedearTransactionFormSchema),
    defaultValues: {
      ticker: '',
      type: TransactionType.BUY,
      quantity: '',
      currency: 'ARS',
      price: '',
      fxRate: '',
      fee: '',
      date: new Date(),
      ...defaultValues,
    },
  })

  const [type, quantity, currency, price, fxRate, fee, date] = useWatch({
    control: form.control,
    name: ['type', 'quantity', 'currency', 'price', 'fxRate', 'fee', 'date'],
  })
  const isBuy = type === TransactionType.BUY

  const { rate: cclRate, note: cclNote } = useDolarRate(CCL, 'sell', date)

  useEffect(() => {
    if (cclRate && autoFxRate.current) {
      form.setValue('fxRate', numberToArInput(cclRate), { shouldValidate: true })
    }
  }, [cclRate, form])

  // Lo que sale (compra) o entra (venta) de Pesos o del Dólar CCL, con la comisión
  const parsed = {
    quantity: parseLocaleAmount(quantity),
    price: parseLocaleAmount(price),
    fee: fee.trim() ? parseLocaleAmount(fee) : 0,
    fx: parseLocaleAmount(fxRate),
  }
  const total =
    parsed.quantity > 0 && parsed.price > 0 && Number.isFinite(parsed.fee)
      ? cedearTotal({ type, quantity: parsed.quantity, price: parsed.price, fee: parsed.fee })
      : null
  const otherCurrency =
    total !== null && parsed.fx > 0
      ? currency === 'ARS'
        ? `US$${formatCurrency(total / parsed.fx)}`
        : `$${formatCurrency(total * parsed.fx)}`
      : null

  // Saldo disponible hoy (la validación por fecha la hacen las funciones puras)
  const balances: Record<CedearCurrency, number> = {
    ARS: computePesosBalance(movements),
    CCL: (cclGroup ?? []).reduce(
      (sum, tx) => sum + (tx.type === TransactionType.BUY ? tx.dollarsAmount : -tx.dollarsAmount),
      0,
    ),
  }
  const shortOfFunds = isBuy && total !== null && total > balances[currency] + 1e-9

  const fillPrice = async (target: Cedear, day: Date) => {
    setLoadingPrice(true)
    try {
      const ars = await fetchCedearPriceOn(target.ticker, day)
      if (ars === null) throw new Error('No hay precio de ese día: ingresalo a mano.')
      const { currency: current, fxRate: rateText } = form.getValues()
      const rate = parseLocaleAmount(rateText)
      if (current === 'CCL' && !(rate > 0)) throw new Error('Primero ingresá el CCL.')
      const value = current === 'ARS' ? ars : ars / rate
      form.setValue('price', numberToArInput(Number(value.toFixed(2))), { shouldValidate: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo obtener el precio.')
    } finally {
      setLoadingPrice(false)
    }
  }

  const handleCedearChange = (selected: Cedear) => {
    setCedear(selected)
    form.setValue('ticker', selected.ticker, { shouldValidate: true })
    if (!form.getValues('price')) void fillPrice(selected, form.getValues('date'))
  }

  /** Al cambiar la moneda, el precio cargado pasa a la otra con el CCL del formulario */
  const handleCurrencyChange = (next: CedearCurrency) => {
    const { currency: current, price: priceText, fxRate: rateText } = form.getValues()
    form.setValue('currency', next)
    const value = parseLocaleAmount(priceText)
    const rate = parseLocaleAmount(rateText)
    if (next === current || !(value > 0) || !(rate > 0)) return
    const converted = next === 'CCL' ? value / rate : value * rate
    form.setValue('price', numberToArInput(Number(converted.toFixed(2))), { shouldValidate: true })
  }

  async function handleSubmit(data: CedearTransactionFormInput) {
    try {
      await onSubmit(parseCedearTransactionFormInput(data))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Algo malió sal.')
    }
  }

  const amountInput = (field: {
    name: string
    ref: React.Ref<HTMLInputElement>
    onBlur: () => void
    value: string
    onChange: (value: string) => void
  }, inputMode: 'decimal' | 'numeric' = 'decimal') => (
    <Input
      type='text'
      inputMode={inputMode}
      autoComplete='off'
      placeholder='0'
      name={field.name}
      ref={field.ref}
      onBlur={field.onBlur}
      value={field.value}
      onChange={(e) => field.onChange(formatAmountArInput(e.target.value))}
    />
  )

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className='space-y-4'>
        <FormField
          control={form.control}
          name='ticker'
          render={() => (
            <FormItem>
              <FormLabel>CEDEAR</FormLabel>
              <FormControl>
                <CedearCombobox value={cedear} onChange={handleCedearChange} />
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
                <RadioGroup onValueChange={field.onChange} value={field.value} className='flex gap-6'>
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
              <FormLabel>Cantidad{cedear ? ` de ${cedear.ticker}` : ''}</FormLabel>
              <FormControl>{amountInput(field, 'numeric')}</FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='currency'
          render={({ field }) => (
            <FormItem className='space-y-3'>
              <FormLabel>{isBuy ? 'Pagado con' : 'Cobrado en'}</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={(value) => handleCurrencyChange(value as CedearCurrency)}
                  value={field.value}
                  className='grid gap-3'
                >
                  <FormItem className='flex items-center gap-3'>
                    <FormControl>
                      <RadioGroupItem value='ARS' />
                    </FormControl>
                    <FormLabel className='font-normal'>
                      Pesos
                      <span className='text-xs tabular-nums text-muted-foreground'>
                        disponible {money('ARS', balances.ARS)}
                      </span>
                    </FormLabel>
                  </FormItem>
                  <FormItem className='flex items-center gap-3'>
                    <FormControl>
                      <RadioGroupItem value='CCL' />
                    </FormControl>
                    <FormLabel className='font-normal'>
                      Dólares CCL
                      <span className='text-xs tabular-nums text-muted-foreground'>
                        disponible {money('CCL', balances.CCL)}
                      </span>
                    </FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='fxRate'
          render={({ field }) => (
            <FormItem>
              <div className='flex items-center justify-between'>
                <FormLabel>CCL (ARS por USD)</FormLabel>
                {cclRate && (
                  <Button
                    type='button'
                    variant='link'
                    size='sm'
                    className='h-auto p-0 text-xs'
                    onClick={() =>
                      form.setValue('fxRate', numberToArInput(cclRate), { shouldValidate: true })
                    }
                  >
                    Usar CCL del día
                  </Button>
                )}
              </div>
              <FormControl>
                {amountInput({
                  ...field,
                  onChange: (value) => {
                    autoFxRate.current = false
                    field.onChange(value)
                  },
                })}
              </FormControl>
              <FormDescription>
                {cclNote ?? 'Convierte el monto a la otra moneda: la posición se sigue en pesos y en dólares.'}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='price'
          render={({ field }) => (
            <FormItem>
              <div className='flex items-center justify-between'>
                <FormLabel>Precio por CEDEAR ({currency === 'ARS' ? 'ARS' : 'USD'})</FormLabel>
                {cedear && (
                  <Button
                    type='button'
                    variant='link'
                    size='sm'
                    className='h-auto p-0 text-xs'
                    disabled={loadingPrice}
                    onClick={() => fillPrice(cedear, date)}
                  >
                    {loadingPrice && <Loader2 className='animate-spin' />}
                    Usar precio del día
                  </Button>
                )}
              </div>
              <FormControl>{amountInput(field)}</FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='fee'
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Comisión y derechos ({currency === 'ARS' ? 'ARS' : 'USD'}, opcional)
              </FormLabel>
              <FormControl>{amountInput(field)}</FormControl>
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
                      {field.value ? mounted && format(field.value, 'dd/MM/yyyy') : <span>Seleccionar fecha</span>}
                      <CalendarIcon className='ml-auto h-4 w-4 opacity-50' />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className='w-auto p-0' align='start'>
                  <Calendar
                    mode='single'
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(day) => day > new Date() || day < new Date('2000-01-01')}
                    captionLayout='dropdown'
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        {total !== null && total > 0 && (
          <div className='space-y-1 rounded-md border p-3 text-sm tabular-nums' aria-live='polite'>
            <p>
              {isBuy ? 'Sale' : 'Entra'}{' '}
              <span className='font-medium'>{money(currency, total)}</span>{' '}
              {currency === 'ARS'
                ? isBuy
                  ? 'de tus pesos'
                  : 'a tus pesos'
                : isBuy
                  ? 'de tus dólares CCL'
                  : 'a tus dólares CCL'}
              {parsed.fee > 0 && ' (con la comisión)'}
            </p>
            {otherCurrency && (
              <p className='text-xs text-muted-foreground'>Equivale a {otherCurrency}.</p>
            )}
            {shortOfFunds && (
              <p className='text-xs text-amber-600 dark:text-amber-400'>
                Hoy no alcanza el saldo.{' '}
                {currency === 'ARS' ? (
                  <Link href='/pesos/nueva' className='underline'>
                    Registrar un ingreso de pesos
                  </Link>
                ) : (
                  <Link href={`/pesos/nueva?modo=conversion&dolar=${CCL}`} className='underline'>
                    Convertir pesos a CCL
                  </Link>
                )}
              </p>
            )}
          </div>
        )}

        <Button type='submit' className='w-full' disabled={form.formState.isSubmitting}>
          {submitLabel}
        </Button>
        {currency === 'CCL' && parsed.price > 0 && parsed.fx > 0 && (
          <p className='text-center text-xs text-muted-foreground tabular-nums'>
            Precio en pesos: ${formatPrice(parsed.price * parsed.fx)} por CEDEAR
          </p>
        )}
      </form>
    </Form>
  )
}
