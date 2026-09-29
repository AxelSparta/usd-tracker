'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { fetchCoinSearch } from '../api'
import type { Coin } from '../types'
import CoinIcon from './CoinIcon'

const DEBOUNCE_MS = 300

// id / aria-* llegan desde <FormControl> y van al botón que abre el buscador
type CoinComboboxProps = React.AriaAttributes & {
  value: Coin | null
  onChange: (coin: Coin) => void
  id?: string
}

/** Buscador de monedas contra CoinGecko; sin texto muestra las de mayor capitalización. */
export default function CoinCombobox({ value, onChange, ...props }: CoinComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Coin[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    // Debounce: una consulta cuando el usuario deja de tipear, no una por tecla
    const timeout = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        setResults(await fetchCoinSearch(query.trim(), controller.signal))
      } catch (err) {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Error al buscar')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, query ? DEBOUNCE_MS : 0)

    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [query, open])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          role='combobox'
          aria-expanded={open}
          className='w-full justify-between font-normal'
          {...props}
        >
          {value ? (
            <span className='flex items-center gap-2'>
              <CoinIcon coin={value} size={18} />
              {value.name}
              <span className='text-muted-foreground'>{value.symbol}</span>
            </span>
          ) : (
            <span className='text-muted-foreground'>Buscar moneda…</span>
          )}
          <ChevronsUpDown className='opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className='w-(--radix-popover-trigger-width) p-0'
        align='start'
      >
        {/* shouldFilter=false: el filtrado lo hace CoinGecko, no cmdk */}
        <Command shouldFilter={false}>
          <CommandInput
            placeholder='Bitcoin, ETH, sol…'
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {loading ? (
              <div className='flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground'>
                <Loader2 className='size-4 animate-spin' />
                Buscando…
              </div>
            ) : (
              <>
                <CommandEmpty>
                  {error ?? 'No encontramos esa moneda.'}
                </CommandEmpty>
                <CommandGroup heading={query ? 'Resultados' : 'Populares'}>
                  {results.map((coin) => (
                    <CommandItem
                      key={coin.id}
                      value={coin.id}
                      onSelect={() => {
                        onChange(coin)
                        setOpen(false)
                      }}
                    >
                      <CoinIcon coin={coin} size={18} />
                      <span className='truncate'>{coin.name}</span>
                      <span className='text-muted-foreground'>{coin.symbol}</span>
                      <Check
                        className={cn(
                          'ml-auto',
                          value?.id === coin.id ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
