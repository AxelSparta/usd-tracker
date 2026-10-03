// Clases literales para que Tailwind las genere; tokens en `globals.css` (paleta validada)
const SERIES = [
  'bg-chart-1',
  'bg-chart-2',
  'bg-chart-3',
  'bg-chart-4',
  'bg-chart-5',
  'bg-chart-6',
] as const

/** `null` = "Otros" (gris de des-énfasis) */
export const seriesBg = (colorIndex: number | null) =>
  colorIndex === null ? 'bg-chart-other' : SERIES[colorIndex % SERIES.length]

export const formatShare = (share: number) =>
  new Intl.NumberFormat('es-AR', { style: 'percent', maximumFractionDigits: 1 }).format(share)
