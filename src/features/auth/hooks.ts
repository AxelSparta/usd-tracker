'use client'

import { useAuth } from '@clerk/nextjs'
import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useCedearsStore } from '@/features/cedears/cedears.store'
import { useCryptoStore } from '@/features/crypto/crypto.store'
import { usePesosStore } from '@/features/pesos/pesos.store'
import { usePortfolios, usePortfoliosStore } from '@/features/portfolios/portfolios.store'
import type { DataSource, SyncStatus } from '@/lib/synced-store'
import { useTransactionStore } from '@/store/transaction.store'
import { fetchCloudIds, importLocalData, type ImportResult } from './api'
import {
  EMPTY_LOCAL_DATA,
  excludeIds,
  localDataIds,
  localNotInCloud,
  toImportPayload,
  type LocalData,
} from './local-import'
import { useSyncStore } from './sync.store'

const flatten = <T>(groups: Partial<Record<string, T[]>>): T[] =>
  Object.values(groups).flatMap((group) => group ?? [])

const syncedStores = [useTransactionStore, useCryptoStore, usePesosStore, useCedearsStore]

const syncFields = (s: { source: DataSource; status: SyncStatus; pendingWrites: number }) => ({
  source: s.source,
  status: s.status,
  pendingWrites: s.pendingWrites,
})

/** Estado combinado de los stores en la nube */
export const useCloudStatus = () => {
  const dolar = useTransactionStore(useShallow(syncFields))
  const crypto = useCryptoStore(useShallow(syncFields))
  const pesos = usePesosStore(useShallow(syncFields))
  const cedears = useCedearsStore(useShallow(syncFields))
  const all = [dolar, crypto, pesos, cedears]
  const statuses: SyncStatus[] = all.map((s) => s.status)

  return {
    isCloud: all.every((s) => s.source === 'cloud'),
    status: statuses.includes('error')
      ? 'error'
      : statuses.some((s) => s === 'pending' || s === 'loading')
        ? 'loading'
        : ('ready' as const),
    pendingWrites: all.reduce((sum, s) => sum + s.pendingWrites, 0),
    retry: () => {
      for (const store of syncedStores) {
        if (store.getState().status === 'error') void store.getState().retryCloud()
      }
    },
  }
}

/**
 * Operaciones de este navegador que no están en la cuenta del usuario (en ningún portafolio). Se
 * suben al portafolio activo (`target`).
 * - `pending`: todas las que faltan (para subir a mano desde el indicador).
 * - `unoffered`: las que todavía no se ofrecieron (abren el diálogo automático).
 * Vacíos mientras no haya sesión o los datos de la nube no hayan cargado.
 */
export const useLocalImport = () => {
  const { userId } = useAuth()
  const { isCloud, status } = useCloudStatus()
  const dolarLocal = useTransactionStore((s) => s.localSnapshot)
  const dolarCloud = useTransactionStore((s) => s.transactions)
  const cryptoLocal = useCryptoStore((s) => s.localSnapshot)
  const cryptoCloud = useCryptoStore(
    useShallow((s) => ({ transactions: s.transactions, coins: s.coins })),
  )
  const pesosLocal = usePesosStore((s) => s.localSnapshot)
  const pesosCloud = usePesosStore((s) => s.movements)
  const cedearsLocal = useCedearsStore((s) => s.localSnapshot)
  const cedearsCloud = useCedearsStore((s) => s.transactions)
  const handled = useSyncStore((s) => (userId ? s.handledIds[userId] : undefined))
  const markHandled = useSyncStore((s) => s.markHandled)

  const { active: target } = usePortfolios()
  // Ids de la cuenta en todos los portafolios: lo subido a otro portafolio no está "pendiente"
  const [cloudIds, setCloudIds] = useState<{ userId: string; ids: Set<string> } | null>(null)
  const signedIn = isCloud && status === 'ready' && !!userId

  useEffect(() => {
    if (!signedIn || !userId) return
    let cancelled = false
    fetchCloudIds().then(
      (ids) => {
        if (!cancelled) setCloudIds({ userId, ids: new Set(ids) })
      },
      // Sin la lista se compara solo con el portafolio activo (la importación igual saltea repetidos)
      () => {
        if (!cancelled) setCloudIds({ userId, ids: new Set() })
      },
    )
    return () => {
      cancelled = true
    }
  }, [signedIn, userId])

  const knownIds = cloudIds && cloudIds.userId === userId ? cloudIds.ids : null
  const ready = signedIn && knownIds !== null

  const pending = useMemo((): LocalData => {
    if (!ready || !knownIds) return EMPTY_LOCAL_DATA
    const notInActive = localNotInCloud(
      {
        dolar: flatten(dolarLocal?.transactions ?? {}),
        crypto: cryptoLocal ?? EMPTY_LOCAL_DATA.crypto,
        pesos: pesosLocal?.movements ?? [],
        cedears: cedearsLocal?.transactions ?? [],
      },
      {
        dolar: flatten(dolarCloud),
        crypto: cryptoCloud,
        pesos: pesosCloud,
        cedears: cedearsCloud,
      },
    )
    return excludeIds(notInActive, knownIds)
  }, [
    ready,
    knownIds,
    dolarLocal,
    dolarCloud,
    cryptoLocal,
    cryptoCloud,
    pesosLocal,
    pesosCloud,
    cedearsLocal,
    cedearsCloud,
  ])

  const unoffered = useMemo(
    () => excludeIds(pending, new Set(handled)),
    [pending, handled],
  )

  /** Sube `data` (por defecto, todo lo pendiente) y recarga la nube */
  const upload = async (data: LocalData = pending): Promise<ImportResult> => {
    const result = await importLocalData(toImportPayload(data))
    if (userId) {
      markHandled(userId, localDataIds(data))
      const ids = new Set(knownIds)
      localDataIds(data).forEach((id) => ids.add(id))
      setCloudIds({ userId, ids })
    }
    usePortfoliosStore.getState().invalidateOthers()
    await Promise.all(syncedStores.map((store) => store.getState().refreshCloud()))
    return result
  }

  /** "Ahora no": no volver a ofrecer estas operaciones automáticamente */
  const dismiss = () => {
    if (userId) markHandled(userId, localDataIds(unoffered))
  }

  return { pending, unoffered, upload, dismiss, target }
}
