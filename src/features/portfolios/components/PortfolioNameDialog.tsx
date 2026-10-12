'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PORTFOLIO_NAME_MAX, portfolioNameSchema } from '../validations'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  submitLabel: string
  initialName?: string
  /** Rechaza con el mensaje para el toast */
  onSubmit: (name: string) => Promise<void>
}

/** Nombre de un portafolio: crear o renombrar */
export default function PortfolioNameDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  initialName = '',
  onSubmit,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-sm'>
        {/* Se monta de nuevo en cada apertura: el campo arranca con `initialName` */}
        {open && (
          <NameForm
            title={title}
            description={description}
            submitLabel={submitLabel}
            initialName={initialName}
            onSubmit={onSubmit}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function NameForm({
  title,
  description,
  submitLabel,
  initialName,
  onSubmit,
  onDone,
}: Omit<Props, 'open' | 'onOpenChange'> & { initialName: string; onDone: () => void }) {
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const parsed = portfolioNameSchema.safeParse(name)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Nombre inválido.')
      return
    }
    setSaving(true)
    try {
      await onSubmit(parsed.data)
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar el portafolio.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-4' noValidate>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <div className='space-y-2'>
        <Label htmlFor='portfolio-name'>Nombre</Label>
        <Input
          id='portfolio-name'
          value={name}
          maxLength={PORTFOLIO_NAME_MAX}
          autoFocus
          autoComplete='off'
          placeholder='Ej. Largo plazo'
          aria-invalid={!!error}
          aria-describedby={error ? 'portfolio-name-error' : undefined}
          onChange={(event) => {
            setName(event.target.value)
            setError(null)
          }}
        />
        {error && (
          <p id='portfolio-name-error' className='text-sm text-destructive'>
            {error}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button type='submit' disabled={saving}>
          {saving ? 'Guardando…' : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}
