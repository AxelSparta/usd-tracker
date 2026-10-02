'use client'

import { ClerkLoading, Show, SignInButton, UserButton } from '@clerk/nextjs'
import { LogIn } from 'lucide-react'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'

/** Sesión en el pie del sidebar: botón de ingreso o el menú de la cuenta. */
export default function UserMenu() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <ClerkLoading>
          {/* Ancho fijo: `SidebarMenuSkeleton` lo sortea con Math.random() y no hidrata igual */}
          <div className='flex h-8 items-center gap-2 px-2'>
            <Skeleton className='size-4 rounded-md' />
            <Skeleton className='h-4 w-24 group-data-[collapsible=icon]:hidden' />
          </div>
        </ClerkLoading>
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
