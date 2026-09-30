'use client'

import { useTheme } from 'next-themes'
import { useSyncExternalStore } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button } from './ui/button'

const subscribe = () => () => {}

export default function ThemeSwitch () {
  // false en SSR / hidratación, true en el cliente: evita mismatch del tema
  const mounted = useSyncExternalStore(subscribe, () => true, () => false)
  const { setTheme, resolvedTheme } = useTheme()

  if (!mounted) {
    return <div className='size-8' aria-hidden />
  }

  const isDark = resolvedTheme === 'dark'

  return (
    <Button
      variant='ghost'
      size='icon'
      className='size-8 text-muted-foreground hover:text-foreground'
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      title={isDark ? 'Tema claro' : 'Tema oscuro'}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  )
}
