import { Bitcoin, DollarSign, type LucideIcon } from 'lucide-react'

export type SectionStatus = 'active' | 'soon'

export type Section = {
  href: string
  label: string
  description: string
  icon: LucideIcon
  status: SectionStatus
}

// Fuente única de las secciones: la usan el sidebar y la home.
// Agregar una sección nueva = agregar una entrada acá.
export const sections: Section[] = [
  {
    href: '/dolar',
    label: 'Dólar',
    description:
      'Compras y ventas de USD por tipo de dólar, costo promedio y ganancias.',
    icon: DollarSign,
    status: 'active',
  },
  {
    href: '/cripto',
    label: 'Cripto',
    description: 'Seguimiento de tus criptomonedas con cotización en vivo.',
    icon: Bitcoin,
    status: 'soon',
  },
]
