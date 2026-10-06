'use client'

import { ClerkLoading, Show, SignInButton, UserButton } from '@clerk/nextjs'
import { LogIn } from 'lucide-react'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { useMounted } from '@/hooks/use-mounted'

// Ancho fijo: `SidebarMenuSkeleton` lo sortea con Math.random() y no hidrata igual
const userMenuSkeleton = (
  <div className='flex h-8 items-center gap-2 px-2'>
    <Skeleton className='size-4 rounded-md' />
    <Skeleton className='h-4 w-24 group-data-[collapsible=icon]:hidden' />
  </div>
)

/** Sesión en el pie del sidebar: botón de ingreso o el menú de la cuenta. */
export default function UserMenu() {
  // `<ClerkLoading>` no hidrata igual si clerk-js termina de cargar antes que la hidratación (pasa en
  // dispositivos lentos y en CI): el server lo renderiza y el cliente no, y React vuelve a montar todo
  // el árbol, perdiendo lo que se haya escrito en un formulario. Hasta montar, siempre el skeleton.
  const mounted = useMounted()
  if (!mounted) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>{userMenuSkeleton}</SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <ClerkLoading>{userMenuSkeleton}</ClerkLoading>
        <Show when='signed-out'>
          <SignInButton mode='modal'>
            <SidebarMenuButton tooltip='Iniciar sesión'>
              <LogIn />
              <span>Iniciar sesión</span>
            </SidebarMenuButton>
          </SignInButton>
        </Show>
        <Show when='signed-in'>
          <div className='flex h-8 items-center px-1'>
            <UserButton
              showName
              appearance={{
                elements: {
                  userButtonBox: 'flex-row-reverse',
                  // Colapsado a íconos: solo el avatar
                  userButtonOuterIdentifier:
                    'text-sm group-data-[collapsible=icon]:hidden',
                },
              }}
            />
          </div>
        </Show>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
