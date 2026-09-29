'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { CalendarIcon, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
  formatAmountArInput,
  formatPrice,
  formatQuantity,
  parseLocaleAmount,
} from '@/lib/locale-amount'
import { TransactionType } from '@/types/transaction.types'
import { fetchCoinPrices } from '../api'
import { useCryptoStore } from '../crypto.store'
import { useCryptoPricesStore } from '../prices.store'
import type { Coin } from '../types'
import {
  cryptoTransactionFormSchema,
  parseCryptoTransactionFormInput,
  type CryptoTransactionFormInput,
} from '../validations'
import CoinCombobox from './CoinCombobox'

/** Número → texto del input con formato AR (1.234,56) */
const toArInput = (n: number) =>
  n.toLocaleString('es-AR', { maximumFractionDigits: 8 })

export default function CryptoTransactionForm() {
  const router = useRouter()
  const addTransaction = useCryptoStore((s) => s.addTransaction)
  const [coin, setCoin] = useState<Coin | null>(null)
  const [loadingPrice, setLoadingPrice] = useState(false)

  const form = useForm<CryptoTransactionFormInput>({
    resolver: zodResolver(cryptoTransactionFormSchema),
    defaultValues: {
      coinId: '',
      type: TransactionType.BUY,
      quantity: '',
      priceUsd: '',
      date: new Date(),
    },
  })

  const [quantity, priceUsd] = useWatch({
    control: form.control,
    name: ['quantity', 'priceUsd'],
  })
  const total = parseLocaleAmount(quantity) * parseLocaleAmount(priceUsd)

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
      form.setValue('priceUsd', toArInput(price.usd), { shouldValidate: true })
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

  function onSubmit(data: CryptoTransactionFormInput) {
    if (!coin) return
    try {
      addTransaction(parseCryptoTransactionFormInput(data), coin)
      toast.success('Operación registrada.')
      router.push('/cripto')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Algo malió sal.')
    }
  }

  return (
    <div className='mx-auto w-full max-w-md'>
      <Card className='shadow-none'>
        <CardHeader>
          <CardTitle>
            <h1 className='text-lg tracking-tight'>Nueva operación</h1>
          </CardTitle>
          <CardDescription>
            Registrá una compra o venta de cripto en dólares.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
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
                Guardar operación
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
