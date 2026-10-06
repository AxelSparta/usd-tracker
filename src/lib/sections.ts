import { Banknote, Bitcoin, DollarSign, type LucideIcon } from 'lucide-react'

export type SectionStatus = 'active' | 'soon'

export type Section = {
  href: string
  label: string
  description: string
  icon: LucideIcon
  status: SectionStatus
  /** Acción principal de la sección (sub-ítem del sidebar) */
  newItem?: { href: string; label: string }
}

// Fuente única de las secciones: la usan el sidebar y la home.
// Agregar una sección nueva = agregar una entrada acá.
export const sections: Section[] = [
  {
    href: '/pesos',
    label: 'Pesos',
    description: 'Ingresos y egresos de pesos: tu saldo en ARS y su equivalente en USD.',
    icon: Banknote,
    status: 'active',
    newItem: { href: '/pesos/nueva', label: 'Nuevo movimiento' },
  },
  {
    href: '/dolar',
    label: 'Dólar',
    description:
      'Compras y ventas de USD por tipo de dólar, costo promedio y ganancias.',
    icon: DollarSign,
    status: 'active',
    newItem: { href: '/dolar/nueva', label: 'Nueva transacción' },
  },
  {
    href: '/cripto',
    label: 'Cripto',
    description:
      'Compras y ventas de cualquier cripto en USD, con precios de CoinGecko.',
    icon: Bitcoin,
    status: 'active',
    newItem: { href: '/cripto/nueva', label: 'Nueva operación' },
  },
]
