'use client'

import { ClerkLoading, Show, SignInButton, UserButton } from '@clerk/nextjs'
import { LogIn } from 'lucide-react'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from '@/components/ui/sidebar'

/** Sesión en el pie del sidebar: botón de ingreso o el menú de la cuenta. */
export default function UserMenu() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <ClerkLoading>
          <SidebarMenuSkeleton showIcon />
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
