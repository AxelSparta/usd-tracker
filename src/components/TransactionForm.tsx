'use client'

import { toast } from 'sonner'
import {
  parseTransactionFormInput,
  transactionFormSchema,
  type TransactionFormInput,
} from '@/validations/transaction'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { TransactionType, type Transaction } from '@/types/transaction.types'
import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarIcon } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { format } from 'date-fns'
import { Calendar } from './ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { RadioGroup, RadioGroupItem } from './ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DolarOption } from '@/types/dolar.types'
import { formatAmountArInput } from '@/lib/locale-amount'

type TransactionFormProps = {
  defaultValues?: Partial<TransactionFormInput>
  submitLabel: string
  /** Puede lanzar un `Error` de negocio: se muestra como toast y el form queda abierto */
  onSubmit: (tx: Omit<Transaction, 'id'>) => void | Promise<void>
}

/** Campos de una transacción de dólar; lo usan el alta y la edición. */
export default function TransactionForm({
  defaultValues,
  submitLabel,
  onSubmit,
}: TransactionFormProps) {
  const form = useForm<TransactionFormInput>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      date: new Date(),
      type: TransactionType.BUY,
      pesosAmount: '',
      dollarsAmount: '',
      dolarOption: DolarOption.Blue,
      ...defaultValues,
    },
  })

  async function handleSubmit(data: TransactionFormInput) {
    try {
      await onSubmit(parseTransactionFormInput(data))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Algo malió sal.')
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className='space-y-4'>
        <FormField
          control={form.control}
          name='pesosAmount'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cantidad pesos</FormLabel>
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
          name='dollarsAmount'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cantidad dólares</FormLabel>
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
          name='dolarOption'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de dólar</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
              >
                {/* FormControl en el trigger: Select (root) no renderiza DOM y perdería id/aria */}
                <FormControl>
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Seleccionar dolar' />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className='w-[200px]'>
                  {Object.values(DolarOption).map((option) => (
                    <SelectItem key={option} value={option}>
                      Dolar {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='type'
          render={({ field }) => (
            <FormItem className='space-y-3'>
              <FormLabel>Tipo de transacción</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value}
                  className='flex flex-col'
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
          name='date'
          render={({ field }) => (
            <FormItem className='flex flex-col'>
              <FormLabel>Día de la transacción</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={'outline'}
                      className={'w-[240px] pl-3 text-left font-normal'}
                    >
                      {field.value ? (
                        <p>{format(field.value, 'dd/MM/yyyy')}</p>
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
                      date > new Date() || date < new Date('1900-01-01')
                    }
                    captionLayout='dropdown'
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type='submit'
          className='w-full'
          disabled={form.formState.isSubmitting}
        >
          {submitLabel}
        </Button>
      </form>
    </Form>
  )
}
