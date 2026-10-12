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
import type { Portfolio } from '../types'

/** Confirmación para borrar un portafolio con todas sus operaciones */
export default function DeletePortfolioDialog({
  portfolio,
  onOpenChange,
  onConfirm,
}: {
  /** `null`: cerrado */
  portfolio: Portfolio | null
  onOpenChange: (open: boolean) => void
  onConfirm: (portfolio: Portfolio) => Promise<void>
}) {
  const [deleting, setDeleting] = useState(false)

  const handleConfirm = async () => {
    if (!portfolio) return
    setDeleting(true)
    try {
      await onConfirm(portfolio)
      toast.success(`Borraste el portafolio «${portfolio.name}».`)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo borrar el portafolio.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={!!portfolio} onOpenChange={(open) => !deleting && onOpenChange(open)}>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>¿Borrar «{portfolio?.name}»?</DialogTitle>
          <DialogDescription>
            Se borran el portafolio y todas sus operaciones de dólar, cripto, pesos y CEDEARs. No
            se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={deleting}>
            Cancelar
          </Button>
          <Button variant='destructive' onClick={handleConfirm} disabled={deleting}>
            {deleting ? 'Borrando…' : 'Borrar portafolio'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
