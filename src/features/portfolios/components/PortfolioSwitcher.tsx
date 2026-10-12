'use client'

import { Check, ChevronsUpDown, FolderOpen, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { useMounted } from '@/hooks/use-mounted'
import { usePortfolios, usePortfoliosStore } from '../portfolios.store'
import type { Portfolio } from '../types'
import DeletePortfolioDialog from './DeletePortfolioDialog'
import PortfolioNameDialog from './PortfolioNameDialog'

const skeleton = (
  <div className='flex h-12 items-center gap-2 px-2'>
    <Skeleton className='size-4 rounded-md' />
    <Skeleton className='h-4 w-28 group-data-[collapsible=icon]:hidden' />
  </div>
)

/**
 * Portafolio activo en el sidebar: cambiar, crear, renombrar o borrar. Todas las secciones
 * muestran y cargan operaciones del activo.
 */
export default function PortfolioSwitcher() {
  const mounted = useMounted()
  const { portfolios, active, status } = usePortfolios()
  const { select, create, rename, remove } = usePortfoliosStore.getState()
  const { isMobile } = useSidebar()
  const [dialog, setDialog] = useState<'create' | 'rename' | null>(null)
  const [toDelete, setToDelete] = useState<Portfolio | null>(null)

  // Hasta saber el origen (sesión o local) la lista no es la definitiva
  if (!mounted || status === 'pending' || status === 'loading' || !active) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>{skeleton}</SidebarMenuItem>
      </SidebarMenu>
    )
  }

  const handleSelect = async (portfolio: Portfolio) => {
    try {
      await select(portfolio.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cambiar de portafolio.')
    }
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size='lg'
                tooltip={`Portafolio: ${active.name}`}
                className='data-[state=open]:bg-sidebar-accent'
              >
                <FolderOpen />
                <div className='grid min-w-0 flex-1 text-left leading-tight'>
                  <span className='text-xs text-muted-foreground'>Portafolio</span>
                  <span className='truncate text-sm font-medium'>{active.name}</span>
                </div>
                <ChevronsUpDown className='ml-auto' />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className='w-(--radix-dropdown-menu-trigger-width) min-w-56'
              side={isMobile ? 'bottom' : 'right'}
              align='start'
            >
              <DropdownMenuLabel>Portafolios</DropdownMenuLabel>
              <DropdownMenuGroup>
                {portfolios.map((portfolio) => (
                  <DropdownMenuItem
                    key={portfolio.id}
                    onSelect={() => void handleSelect(portfolio)}
                  >
                    <span className='flex-1 truncate'>{portfolio.name}</span>
                    {portfolio.id === active.id && <Check aria-label='Activo' />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setDialog('create')}>
                <Plus />
                Nuevo portafolio
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDialog('rename')}>
                <Pencil />
                Renombrar «{active.name}»
              </DropdownMenuItem>
              <DropdownMenuItem
                variant='destructive'
                disabled={portfolios.length === 1}
                onSelect={() => setToDelete(active)}
              >
                <Trash2 />
                Borrar «{active.name}»
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <PortfolioNameDialog
        open={dialog === 'create'}
        onOpenChange={(open) => !open && setDialog(null)}
        title='Nuevo portafolio'
        description='Tiene sus propios saldos y operaciones de dólar, cripto, pesos y CEDEARs.'
        submitLabel='Crear'
        onSubmit={create}
      />
      <PortfolioNameDialog
        open={dialog === 'rename'}
        onOpenChange={(open) => !open && setDialog(null)}
        title='Renombrar portafolio'
        description='Solo cambia el nombre: las operaciones quedan igual.'
        submitLabel='Guardar'
        initialName={active.name}
        onSubmit={(name) => rename(active.id, name)}
      />
      <DeletePortfolioDialog
        portfolio={toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        onConfirm={(portfolio) => remove(portfolio.id)}
      />
    </>
  )
}
