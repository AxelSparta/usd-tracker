'use client'
import { transactionFormSchema } from '@/app/validations/transaction'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useTransactionStore } from '@/store/transaction.store'
import { TransactionType } from '@/types/transaction.types'
import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarIcon } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Calendar } from './ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { RadioGroup, RadioGroupItem } from './ui/radio-group'

export default function NewTransactionForm () {
  const addTransaction = useTransactionStore(state => state.addTransaction)
  const transactionsData = useTransactionStore(state => state.transactionsData)

  const form = useForm<z.infer<typeof transactionFormSchema>>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      date: new Date(),
      type: TransactionType.BUY
    }
  })

  async function onSubmit (values: z.infer<typeof transactionFormSchema>) {
    const newTransaction = {
      pesosAmount: values.pesosAmount,
      dollarsAmount: values.dollarsAmount,
      usdPrice: values.pesosAmount / values.dollarsAmount,
      type: values.type,
      date: values.date
    }
    if (
      newTransaction.type === TransactionType.SELL &&
      newTransaction.dollarsAmount > transactionsData.totalUsd
    ) {
      toast.error('No puedes vender más dólares de los que tienes.')
      return
    }
    try {
      await addTransaction({
        isSignedIn: false,
        tx: newTransaction
      })
      toast.success('Transacción creada con éxito.')
    } catch (err) {
      console.error(err)
      toast.error('Algo malió sal.')
    } finally {
      form.reset()
    }
  }

  return (
    <div>
      <Card className='shadow-xl dark:bg-slate-800'>
        <CardHeader>
          <CardTitle>
            <h2>Agregar transacción</h2>
          </CardTitle>

        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}
              className='space-y-4'>
              <FormField
                control={form.control}
                name='pesosAmount'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cantidad pesos</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        {...field}
                        value={field.value || ''}
                        onChange={e => field.onChange(e.target.valueAsNumber)}
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
                        type='number'
                        {...field}
                        value={field.value || ''}
                        onChange={e => field.onChange(e.target.valueAsNumber)}
                      />
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
                              <p>{field.value.toLocaleDateString()}</p>
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
                          disabled={date =>
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
              <Button type='submit'>Crear Transacción</Button>
            </form>
          </Form>
        </CardContent>
      </Card>

    </div>
  )
}
