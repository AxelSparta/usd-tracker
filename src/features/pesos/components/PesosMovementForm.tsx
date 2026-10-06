'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
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
import { formatAmountArInput } from '@/lib/locale-amount'
import { TransactionType } from '@/types/transaction.types'
import type { PesosMovement } from '../types'
import {
  parsePesosMovementFormInput,
  pesosMovementFormSchema,
  type PesosMovementFormInput,
} from '../validations'

type PesosMovementFormProps = {
  defaultValues?: Partial<PesosMovementFormInput>
  submitLabel: string
  /** Puede lanzar un `Error` de negocio: se muestra como toast y el form queda abierto */
  onSubmit: (movement: Omit<PesosMovement, 'id'>) => void | Promise<void>
}

/** Ingreso o egreso de pesos. Lo usan el alta y la edición. */
export default function PesosMovementForm({
  defaultValues,
  submitLabel,
  onSubmit,
}: PesosMovementFormProps) {
  const form = useForm<PesosMovementFormInput>({
    resolver: zodResolver(pesosMovementFormSchema),
    defaultValues: {
      type: TransactionType.BUY,
      amount: '',
      note: '',
      date: new Date(),
      ...defaultValues,
    },
  })

  async function handleSubmit(data: PesosMovementFormInput) {
    try {
      await onSubmit(parsePesosMovementFormInput(data))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Algo malió sal.')
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className='space-y-4'>
        <FormField
          control={form.control}
          name='type'
          render={({ field }) => (
            <FormItem className='space-y-3'>
              <FormLabel>Movimiento</FormLabel>
              <FormControl>
                <RadioGroup onValueChange={field.onChange} value={field.value} className='flex gap-6'>
                  <FormItem className='flex items-center gap-3'>
                    <FormControl>
                      <RadioGroupItem value={TransactionType.BUY} />
                    </FormControl>
                    <FormLabel className='font-normal'>Ingreso</FormLabel>
                  </FormItem>
                  <FormItem className='flex items-center gap-3'>
                    <FormControl>
                      <RadioGroupItem value={TransactionType.SELL} />
                    </FormControl>
                    <FormLabel className='font-normal'>Egreso</FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='amount'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Monto (ARS)</FormLabel>
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
        <FormField
          control={form.control}
          name='note'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nota (opcional)</FormLabel>
              <FormControl>
                <Input placeholder='Sueldo, transferencia desde el banco…' autoComplete='off' {...field} />
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
                    disabled={(day) => day > new Date() || day < new Date('1900-01-01')}
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
