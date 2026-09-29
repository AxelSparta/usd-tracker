'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { House, Plus, Wallet } from 'lucide-react'
import { FaGithub, FaLinkedin } from 'react-icons/fa'
import { PiSuitcaseSimpleBold } from 'react-icons/pi'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import { sections } from '@/lib/sections'
import ThemeSwitch from './ThemeSwitch'

const socialLinks = [
  { href: 'https://github.com/axelsparta', label: 'GitHub', icon: FaGithub },
  {
    href: 'https://www.linkedin.com/in/axel-sparta-web/',
    label: 'LinkedIn',
    icon: FaLinkedin,
  },
  {
    href: 'https://axelsparta.netlify.app/',
    label: 'Portfolio',
    icon: PiSuitcaseSimpleBold,
  },
]

export default function AppSidebar() {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()

  // En mobile el sidebar es un drawer: cerrarlo al navegar
  const handleNavigate = () => {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <Sidebar collapsible='icon'>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size='lg' tooltip='Portfolio'>
              <Link href='/' onClick={handleNavigate}>
                <div className='flex aspect-square size-8 items-center justify-center rounded-md bg-primary text-primary-foreground'>
                  <Wallet className='size-4' />
                </div>
                <span className='font-semibold tracking-tight'>Portfolio</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === '/'}
                  tooltip='Inicio'
                >
                  <Link href='/' onClick={handleNavigate}>
                    <House />
                    <span>Inicio</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Trackers</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sections.map((section) => {
                const isActive = pathname.startsWith(section.href)
                return (
                  <SidebarMenuItem key={section.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={section.label}
                    >
                      <Link href={section.href} onClick={handleNavigate}>
                        <section.icon />
                        <span>{section.label}</span>
                      </Link>
                    </SidebarMenuButton>
                    {section.status === 'soon' && (
                      <SidebarMenuBadge className='text-muted-foreground font-normal'>
                        Pronto
                      </SidebarMenuBadge>
                    )}
                    {section.newItem && (
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            asChild
                            isActive={pathname === section.newItem.href}
                          >
                            <Link href={section.newItem.href} onClick={handleNavigate}>
                              <Plus />
                              <span>{section.newItem.label}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className='flex items-center justify-between gap-2 group-data-[collapsible=icon]:flex-col'>
          <ThemeSwitch />
          <ul className='flex items-center gap-1 group-data-[collapsible=icon]:hidden'>
            {socialLinks.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <a
                  href={href}
                  target='_blank'
                  rel='noreferrer'
                  aria-label={label}
                  className='flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground'
                >
                  <Icon className='size-4' />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
