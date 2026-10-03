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
import { useLocalImport } from '../hooks'
import { countLocalData } from '../local-import'
import { describeImportResult, describeLocalData } from './describe'

/**
 * Al iniciar sesión, si hay operaciones de este navegador que no están en la cuenta
 * (y no se ofrecieron antes), propone subirlas. No se cierra solo mientras sube.
 */
export default function LocalImportDialog() {
  const { unoffered, upload, dismiss } = useLocalImport()
  const [uploading, setUploading] = useState(false)
  const open = countLocalData(unoffered) > 0

  const handleUpload = async () => {
    setUploading(true)
    try {
      toast.success(describeImportResult(await upload(unoffered)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudieron subir las operaciones.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !uploading) dismiss()
      }}
    >
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Tenés operaciones en este navegador</DialogTitle>
          <DialogDescription>
            Encontramos {describeLocalData(unoffered)} que cargaste sin sesión. ¿Las subimos
            a tu cuenta? Las que ya estén en la nube no se duplican.
          </DialogDescription>
        </DialogHeader>
        <p className='text-sm text-muted-foreground'>
          Si elegís &quot;Ahora no&quot;, las podés subir más tarde desde el indicador de la
          barra superior. Siguen guardadas en este navegador.
        </p>
        <DialogFooter>
          <Button variant='outline' onClick={dismiss} disabled={uploading}>
            Ahora no
          </Button>
          <Button onClick={handleUpload} disabled={uploading}>
            {uploading ? 'Subiendo…' : 'Subir a mi cuenta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
