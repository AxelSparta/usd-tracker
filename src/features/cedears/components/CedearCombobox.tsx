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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { fetchCedearSearch } from '../api'
import type { Cedear } from '../types'

const DEBOUNCE_MS = 300

// id / aria-* llegan desde <FormControl> y van al botón que abre el buscador
type CedearComboboxProps = React.AriaAttributes & {
  value: Cedear | null
  onChange: (cedear: Cedear) => void
  id?: string
}

/** Buscador de CEDEARs (ticker o nombre) contra data912; sin texto muestra los más operados. */
export default function CedearCombobox({ value, onChange, ...props }: CedearComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Cedear[]>([])
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
        setResults(await fetchCedearSearch(query.trim(), controller.signal))
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
              <span className='font-medium'>{value.ticker}</span>
              {value.name && <span className='text-muted-foreground'>{value.name}</span>}
            </span>
          ) : (
            <span className='text-muted-foreground'>Buscar CEDEAR…</span>
          )}
          <ChevronsUpDown className='opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-(--radix-popover-trigger-width) p-0' align='start'>
        {/* shouldFilter=false: el filtrado lo hace nuestra API, no cmdk */}
        <Command shouldFilter={false}>
          <CommandInput placeholder='AAPL, Mercado Libre…' value={query} onValueChange={setQuery} />
          <CommandList>
            {loading ? (
              <div className='flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground'>
                <Loader2 className='size-4 animate-spin' />
                Buscando…
              </div>
            ) : (
              <>
                <CommandEmpty>{error ?? 'No encontramos ese CEDEAR.'}</CommandEmpty>
                <CommandGroup heading={query ? 'Resultados' : 'Más operados hoy'}>
                  {results.map((cedear) => (
                    <CommandItem
                      key={cedear.ticker}
                      value={cedear.ticker}
                      onSelect={() => {
                        onChange(cedear)
                        setOpen(false)
                      }}
                    >
                      <span className='font-medium'>{cedear.ticker}</span>
                      {cedear.name && (
                        <span className='truncate text-muted-foreground'>{cedear.name}</span>
                      )}
                      <Check
                        className={cn(
                          'ml-auto',
                          value?.ticker === cedear.ticker ? 'opacity-100' : 'opacity-0',
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
