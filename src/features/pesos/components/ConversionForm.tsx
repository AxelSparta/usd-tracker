'use client'

import { useRouter } from 'next/navigation'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDolarRate } from '@/hooks/use-dolar-rate'
import { DOLAR_LABELS } from '@/lib/dolar-labels'
import {
  formatAmountArInput,
  formatCurrency,
  numberToArInput,
  parseLocaleAmount,
} from '@/lib/locale-amount'
import { useTransactionStore } from '@/store/transaction.store'
import { DolarOption } from '@/types/dolar.types'
import { TransactionType } from '@/types/transaction.types'
import { addConversion } from '../actions'
import { computePesosBalance } from '../operations'
import { usePesosStore } from '../pesos.store'
import {
  conversionFormSchema,
  parseConversionFormInput,
  type ConversionFormInput,
} from '../validations'

type ConversionFormProps = {
  /** `?dolar=<tipo>`: viene preseleccionado (atajo "Comprar con pesos" desde `/dolar`) */
  defaultDolarOption?: DolarOption
}

/**
 * Conversión pesos ↔ dólar: se cargan los dos montos (con impuestos y comisiones, como en el
 * formulario del Dólar). La cotización del día es solo una referencia para completar uno desde el otro.
 */
export default function ConversionForm({ defaultDolarOption }: ConversionFormProps) {
  const router = useRouter()
  const movements = usePesosStore((s) => s.movements)
  const dolarGroups = useTransactionStore((s) => s.transactions)
  const form = useForm<ConversionFormInput>({
    resolver: zodResolver(conversionFormSchema),
    defaultValues: {
      direction: 'PESOS_TO_DOLAR',
      dolarOption: defaultDolarOption ?? DolarOption.Blue,
      pesosAmount: '',
      dollarsAmount: '',
      date: new Date(),
    },
  })
  const [direction, dolarOption, pesosAmount, dollarsAmount, date] = useWatch({
    control: form.control,
    name: ['direction', 'dolarOption', 'pesosAmount', 'dollarsAmount', 'date'],
  })
  const toDolar = direction === 'PESOS_TO_DOLAR'

  // Se compran dólares: venta; se venden: compra (la punta de una operación normal del Dólar)
  const { rate, note: rateNote } = useDolarRate(dolarOption, toDolar ? 'sell' : 'buy', date)

  const pesos = parseLocaleAmount(pesosAmount)
  const dollars = parseLocaleAmount(dollarsAmount)
  const implicitRate = pesos > 0 && dollars > 0 ? pesos / dollars : null

  // Saldo disponible hoy de lo que se entrega (la validación por fecha la hacen las funciones puras)
  const usdBalance = (dolarGroups[dolarOption] ?? []).reduce(
    (sum, tx) => sum + (tx.type === TransactionType.BUY ? tx.dollarsAmount : -tx.dollarsAmount),
    0,
  )
  const available = toDolar
    ? `$${formatCurrency(computePesosBalance(movements))}`
    : `US$${formatCurrency(usdBalance)} ${DOLAR_LABELS[dolarOption]}`

  const fillFromRate = (target: 'pesosAmount' | 'dollarsAmount') => {
    if (!rate) return
    const source = target === 'pesosAmount' ? dollars : pesos
    if (!(source > 0)) {
      toast.error(
        target === 'pesosAmount' ? 'Primero ingresá los dólares.' : 'Primero ingresá los pesos.',
      )
      return
    }
    const value = target === 'pesosAmount' ? source * rate : source / rate
    form.setValue(target, numberToArInput(Number(value.toFixed(2))), { shouldValidate: true })
  }

  async function handleSubmit(data: ConversionFormInput) {
    try {
      await addConversion(parseConversionFormInput(data))
      toast.success('Conversión registrada.')
      router.push('/pesos')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Algo malió sal.')
    }
  }

  const amountInput = (
    name: 'pesosAmount' | 'dollarsAmount',
    label: string,
    fillLabel: string,
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <div className='flex items-center justify-between'>
            <FormLabel>{label}</FormLabel>
            {rate && (
              <Button
                type='button'
                variant='link'
                size='sm'
                className='h-auto p-0 text-xs'
                onClick={() => fillFromRate(name)}
              >
                {fillLabel}
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
          name='direction'
          render={({ field }) => (
            <FormItem className='space-y-3'>
              <FormLabel>Dirección</FormLabel>
              <FormControl>
                <RadioGroup onValueChange={field.onChange} value={field.value} className='flex gap-6'>
                  <FormItem className='flex items-center gap-3'>
                    <FormControl>
                      <RadioGroupItem value='PESOS_TO_DOLAR' />
                    </FormControl>
                    <FormLabel className='font-normal'>Pesos → dólares</FormLabel>
                  </FormItem>
                  <FormItem className='flex items-center gap-3'>
                    <FormControl>
                      <RadioGroupItem value='DOLAR_TO_PESOS' />
                    </FormControl>
                    <FormLabel className='font-normal'>Dólares → pesos</FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='dolarOption'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de dólar</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                {/* FormControl en el trigger: Select (root) no renderiza DOM y perdería id/aria */}
                <FormControl>
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Seleccionar dólar' />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.values(DolarOption).map((option) => (
                    <SelectItem key={option} value={option}>
                      Dólar {DOLAR_LABELS[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>Disponible: {available}</FormDescription>
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
                    disabled={(day) => day > new Date() || day < new Date('1900-01-01')}
                    captionLayout='dropdown'
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
        {amountInput(
          'pesosAmount',
          toDolar ? 'Pesos que salen (ARS)' : 'Pesos que entran (ARS)',
          'Calcular desde USD',
        )}
        {amountInput(
          'dollarsAmount',
          toDolar ? 'Dólares que recibís (USD)' : 'Dólares que entregás (USD)',
          'Calcular desde ARS',
        )}
        <div className='space-y-1 text-sm tabular-nums text-muted-foreground'>
          <p>
            {rate
              ? `Referencia: $${formatCurrency(rate)} · ${rateNote}`
              : (rateNote ?? 'Buscando la cotización del día…')}
          </p>
          {implicitRate && <p>Cotización implícita: ${formatCurrency(implicitRate)}</p>}
        </div>
        <Button type='submit' className='w-full' disabled={form.formState.isSubmitting}>
          Guardar conversión
        </Button>
      </form>
    </Form>
  )
}
