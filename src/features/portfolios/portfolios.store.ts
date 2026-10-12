import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DataSource } from '@/lib/synced-store'
import { setCloudPortfolioId } from '@/lib/portfolio-scope'
import { fetchCloudPortfolio, portfoliosApi } from './api'
import {
  clearLocalPortfolio,
  LOCAL_DEFAULT_PORTFOLIO_ID,
  readLocalPortfolio,
  reloadCloudStores,
  switchLocalPortfolio,
  type PortfolioData,
} from './data-stores'
import type { Portfolio } from './types'
import { portfolioNameSchema } from './validations'

/**
 * Portafolios del usuario y cuál está activo. Sin sesión, la lista vive en `localStorage` (cada
 * portafolio local guarda sus datos en sus propias claves); con sesión, viene de la API y el activo
 * se recuerda por usuario. Los stores de datos siempre tienen solo el activo (`data-stores.ts`).
 */

export type PortfoliosStatus = 'pending' | 'loading' | 'ready' | 'error'

type OtherEntry =
  | { status: 'loading' }
  | { status: 'ready'; data: PortfolioData }
  | { status: 'error' }

interface PortfoliosState {
  source: DataSource
  status: PortfoliosStatus
  local: { portfolios: Portfolio[]; activeId: string }
  cloud: { portfolios: Portfolio[]; activeId: string | null }
  userId: string | null
  /** Último portafolio activo de cada usuario en este navegador */
  cloudActiveByUser: Record<string, string>
  /** Dashboard: todos los portafolios sumados (si hay más de uno) */
  showAll: boolean
  /** Datos de los portafolios no activos para la vista "Todos" (cache de la sesión) */
  others: Record<string, OtherEntry>

  connectLocal: () => Promise<void>
  /** Carga la lista de la nube y fija el portafolio activo (los stores de datos los conecta `CloudSync`) */
  connectCloud: (userId: string) => Promise<void>
  select: (id: string) => Promise<void>
  /** Crea un portafolio vacío y lo deja activo */
  create: (name: string) => Promise<void>
  rename: (id: string, name: string) => Promise<void>
  /** Borra el portafolio y sus operaciones; si era el activo, pasa al primero que quede */
  remove: (id: string) => Promise<void>
  setShowAll: (showAll: boolean) => void
  /** Carga (si falta) los datos de los portafolios no activos */
  loadOthers: () => void
  /** Olvida lo cacheado de los portafolios no activos (ej. después de importar) */
  invalidateOthers: () => void
}

const DEFAULT_LOCAL: PortfoliosState['local'] = {
  portfolios: [{ id: LOCAL_DEFAULT_PORTFOLIO_ID, name: 'Principal' }],
  activeId: LOCAL_DEFAULT_PORTFOLIO_ID,
}

const otherKey = (source: DataSource, id: string) => `${source}:${id}`

/** Lista y activo del origen actual */
export const selectScoped = (s: Pick<PortfoliosState, 'source' | 'local' | 'cloud'>) =>
  s.source === 'cloud' ? s.cloud : s.local

const parseName = (name: string) => {
  const result = portfolioNameSchema.safeParse(name)
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? 'Nombre inválido.')
  return result.data
}

export const usePortfoliosStore = create<PortfoliosState>()(
  persist(
    (set, get) => {
      const withoutOthers = (...ids: string[]) => {
        const others = { ...get().others }
        for (const id of ids) delete others[otherKey(get().source, id)]
        return others
      }

      const activate = async (id: string) => {
        const { source, local, cloud, userId } = get()
        if (source === 'cloud') {
          // El que deja de estar activo pudo cambiar: se vuelve a leer si hace falta
          set({
            cloud: { ...cloud, activeId: id },
            others: withoutOthers(id, cloud.activeId ?? ''),
            ...(userId && { cloudActiveByUser: { ...get().cloudActiveByUser, [userId]: id } }),
          })
          setCloudPortfolioId(id)
          await reloadCloudStores()
        } else {
          set({ local: { ...local, activeId: id }, others: withoutOthers(id, local.activeId) })
          await switchLocalPortfolio(id)
        }
      }

      return {
        source: 'local',
        status: 'pending',
        local: DEFAULT_LOCAL,
        cloud: { portfolios: [], activeId: null },
        userId: null,
        cloudActiveByUser: {},
        showAll: false,
        others: {},

        connectLocal: async () => {
          setCloudPortfolioId(null)
          const { local, source } = get()
          const portfolios = local.portfolios.length > 0 ? local.portfolios : DEFAULT_LOCAL.portfolios
          const activeId = portfolios.some((p) => p.id === local.activeId)
            ? local.activeId
            : portfolios[0].id
          set({
            source: 'local',
            status: 'ready',
            userId: null,
            local: { portfolios, activeId },
            cloud: { portfolios: [], activeId: null },
            ...(source !== 'local' && { others: {} }),
          })
          await switchLocalPortfolio(activeId)
        },

        connectCloud: async (userId) => {
          set({
            source: 'cloud',
            status: 'loading',
            userId,
            others: get().userId === userId && get().source === 'cloud' ? get().others : {},
          })
          try {
            const portfolios = await portfoliosApi.list()
            if (get().userId !== userId || get().source !== 'cloud') return
            const remembered = get().cloudActiveByUser[userId]
            const activeId = portfolios.some((p) => p.id === remembered)
              ? remembered
              : portfolios[0].id
            setCloudPortfolioId(activeId)
            set({ status: 'ready', cloud: { portfolios, activeId } })
          } catch {
            // Sin lista, los datos igual cargan: sin header, el server usa el portafolio principal
            setCloudPortfolioId(null)
            if (get().userId === userId) set({ status: 'error' })
          }
        },

        select: async (id) => {
          const scoped = selectScoped(get())
          if (id === scoped.activeId || !scoped.portfolios.some((p) => p.id === id)) return
          await activate(id)
        },

        create: async (rawName) => {
          const portfolio: Portfolio = { id: crypto.randomUUID(), name: parseName(rawName) }
          if (get().source === 'cloud') {
            await portfoliosApi.create(portfolio)
            const { cloud } = get()
            set({ cloud: { ...cloud, portfolios: [...cloud.portfolios, portfolio] } })
          } else {
            const { local } = get()
            set({ local: { ...local, portfolios: [...local.portfolios, portfolio] } })
          }
          await activate(portfolio.id)
        },

        rename: async (id, rawName) => {
          const name = parseName(rawName)
          const rename = (list: Portfolio[]) => list.map((p) => (p.id === id ? { ...p, name } : p))
          if (get().source === 'cloud') {
            await portfoliosApi.rename(id, name)
            const { cloud } = get()
            set({ cloud: { ...cloud, portfolios: rename(cloud.portfolios) } })
          } else {
            const { local } = get()
            set({ local: { ...local, portfolios: rename(local.portfolios) } })
          }
        },

        remove: async (id) => {
          const scoped = selectScoped(get())
          const rest = scoped.portfolios.filter((p) => p.id !== id)
          if (rest.length === scoped.portfolios.length) return
          if (rest.length === 0) throw new Error('No podés borrar tu único portafolio.')

          if (get().source === 'cloud') {
            await portfoliosApi.remove(id)
            const { cloud } = get()
            set({ cloud: { ...cloud, portfolios: rest }, others: withoutOthers(id) })
            if (cloud.activeId === id) await activate(rest[0].id)
          } else {
            // Primero se deja de usar sus claves; después se borran
            if (get().local.activeId === id) await activate(rest[0].id)
            clearLocalPortfolio(id)
            set({ local: { ...get().local, portfolios: rest }, others: withoutOthers(id) })
          }
        },

        setShowAll: (showAll) => set({ showAll }),

        loadOthers: () => {
          const { source, status } = get()
          if (status !== 'ready') return
          const { portfolios, activeId } = selectScoped(get())
          for (const { id } of portfolios) {
            const key = otherKey(source, id)
            if (id === activeId || get().others[key]) continue
            if (source === 'local') {
              set({ others: { ...get().others, [key]: { status: 'ready', data: readLocalPortfolio(id) } } })
              continue
            }
            set({ others: { ...get().others, [key]: { status: 'loading' } } })
            fetchCloudPortfolio(id).then(
              (data) => {
                if (get().others[key]) set({ others: { ...get().others, [key]: { status: 'ready', data } } })
              },
              () => {
                if (get().others[key]) set({ others: { ...get().others, [key]: { status: 'error' } } })
              },
            )
          }
        },

        invalidateOthers: () => set({ others: {} }),
      }
    },
    {
      name: 'portfolios-storage',
      version: 1,
      partialize: ({ local, cloudActiveByUser, showAll }) => ({ local, cloudActiveByUser, showAll }),
    },
  ),
)

/** Portafolios del origen actual y el activo */
export const usePortfolios = () => {
  const source = usePortfoliosStore((s) => s.source)
  const local = usePortfoliosStore((s) => s.local)
  const cloud = usePortfoliosStore((s) => s.cloud)
  const status = usePortfoliosStore((s) => s.status)
  const { portfolios, activeId } = selectScoped({ source, local, cloud })
  return {
    portfolios,
    active: portfolios.find((p) => p.id === activeId) ?? null,
    status,
    source,
  }
}

export { otherKey }
