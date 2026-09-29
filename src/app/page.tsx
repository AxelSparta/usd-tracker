import Link from 'next/link'
import { ArrowRight, HardDrive, ListPlus, RefreshCw } from 'lucide-react'
import { sections } from '@/lib/sections'
import { cn } from '@/lib/utils'

const steps = [
  {
    icon: ListPlus,
    title: 'Registrá tus operaciones',
    text: 'Cargá compras y ventas con el monto en pesos, el activo y la fecha.',
  },
  {
    icon: RefreshCw,
    title: 'Cotizaciones en vivo',
    text: 'Los precios se actualizan solos y tus métricas se recalculan al instante.',
  },
  {
    icon: HardDrive,
    title: 'Tus datos, en tu navegador',
    text: 'Sin cuentas ni servidores: todo se guarda localmente en este dispositivo.',
  },
]

export default function Home() {
  return (
    <div className='space-y-16'>
      <section className='max-w-2xl space-y-4'>
        <p className='text-sm text-muted-foreground'>Portfolio Tracker</p>
        <h1 className='text-3xl font-semibold tracking-tight text-balance md:text-4xl'>
          Tus inversiones, en un solo lugar.
        </h1>
        <p className='text-muted-foreground text-pretty'>
          Seguí tus ahorros en dólares y cripto con cotizaciones del mercado
          argentino: costo promedio, valor actual y ganancias realizadas y no
          realizadas, sin planillas.
        </p>
      </section>

      <section className='space-y-4'>
        <h2 className='text-sm font-medium text-muted-foreground'>Trackers</h2>
        <ul className='grid gap-4 sm:grid-cols-2'>
          {sections.map((section) => {
            const isActive = section.status === 'active'
            const content = (
              <>
                <div className='flex items-center justify-between'>
                  <section.icon className='size-5 text-muted-foreground' />
                  {isActive ? (
                    <ArrowRight className='size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground' />
                  ) : (
                    <span className='rounded-full border px-2 py-0.5 text-xs text-muted-foreground'>
                      Próximamente
                    </span>
                  )}
                </div>
                <div className='space-y-1'>
                  <h3 className='font-medium'>{section.label}</h3>
                  <p className='text-sm text-muted-foreground'>
                    {section.description}
                  </p>
                </div>
              </>
            )
            const className = cn(
              'group flex h-full flex-col gap-6 rounded-lg border bg-card p-5',
              isActive
                ? 'transition-colors hover:border-foreground/20 hover:bg-accent/40'
                : 'opacity-60',
            )

            return (
              <li key={section.href}>
                {isActive ? (
                  <Link href={section.href} className={className}>
                    {content}
                  </Link>
                ) : (
                  <div className={className} aria-disabled>
                    {content}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <section className='space-y-6'>
        <h2 className='text-sm font-medium text-muted-foreground'>
          Cómo funciona
        </h2>
        <ol className='grid gap-8 sm:grid-cols-3'>
          {steps.map(({ icon: Icon, title, text }) => (
            <li key={title} className='space-y-2'>
              <Icon className='size-5 text-muted-foreground' />
              <h3 className='font-medium'>{title}</h3>
              <p className='text-sm text-muted-foreground'>{text}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
