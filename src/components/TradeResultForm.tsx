'use client'

import { useEffect, useRef } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
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
import { useDolarCriptoRate } from '@/hooks/use-dolar-cripto-rate'
import { formatAmountArInput, formatCurrency, numberToArInput, parseLocaleAmount } from '@/lib/locale-amount'
import { TransactionType, type Transaction } from '@/types/transaction.types'
import {
  parseTradeResultFormInput,
  tradeResultFormSchema,
  type TradeResultFormInput,
} from '@/validations/transaction'

type TradeResultFormProps = {
  defaultValues?: Partial<TradeResultFormInput>
  submitLabel: string
  /** Puede lanzar un `Error` de negocio: se muestra como toast y el form queda abierto */
  onSubmit: (tx: Omit<Transaction, 'id'>) => void | Promise<void>
}

/**
 * Resultado de un trade acreditado en USDT (futuros, margin, bots): entra o sale del dólar cripto
 * sin compra ni venta de por medio. Lo usan el alta y la edición.
 */
export default function TradeResultForm({ defaultValues, submitLabel, onSubmit }: TradeResultFormProps) {
  const form = useForm<TradeResultFormInput>({
    resolver: zodResolver(tradeResultFormSchema),
    defaultValues: {
      type: TransactionType.BUY,
      dollarsAmount: '',
      arsRate: '',
      note: '',
      date: new Date(),
      ...defaultValues,
    },
  })
  const [type, dollarsAmount, arsRate, date] = useWatch({
    control: form.control,
    name: ['type', 'dollarsAmount', 'arsRate', 'date'],
  })
  const isGain = type === TransactionType.BUY

  // Entran USDT → venta (lo que costaría comprarlos); salen → compra. Sin pisar lo que se escribe a mano
  const { rate, note: rateNote } = useDolarCriptoRate(isGain ? 'sell' : 'buy', date)
  // Al editar, la cotización guardada cuenta como escrita a mano: no se reemplaza
  const autoRate = useRef('')
  useEffect(() => {
    const current = form.getValues('arsRate')
    if (current && current !== autoRate.current) return
    const text = rate ? numberToArInput(rate) : ''
    autoRate.current = text
    form.setValue('arsRate', text, { shouldValidate: Boolean(text) })
  }, [rate, form])

  const pesos = parseLocaleAmount(dollarsAmount) * parseLocaleAmount(arsRate)
  const summary =
    Number.isFinite(pesos) && pesos > 0
      ? isGain
        ? `Entran ${formatCurrency(parseLocaleAmount(dollarsAmount))} USDT con un costo de $${formatCurrency(pesos)}, que se suma a la ganancia realizada.`
        : `Salen ${formatCurrency(parseLocaleAmount(dollarsAmount))} USDT sin cobrar nada: se realiza su costo promedio como pérdida.`
      : null

  async function handleSubmit(data: TradeResultFormInput) {
    try {
      await onSubmit(parseTradeResultFormInput(data))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Algo malió sal.')
    }
  }

  const amountInput = (name: 'dollarsAmount' | 'arsRate', label: string, description?: string | null) => (
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
          {description && <FormDescription>{description}</FormDescription>}
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
        {amountInput('dollarsAmount', 'Cantidad de USDT')}
        {amountInput('arsRate', 'Cotización del dólar cripto (ARS)', rateNote)}
        {summary && <p className='text-sm text-muted-foreground'>{summary}</p>}
        <FormField
          control={form.control}
          name='note'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nota (opcional)</FormLabel>
              <FormControl>
                <Input placeholder='BTCUSDT long x10' autoComplete='off' {...field} />
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
