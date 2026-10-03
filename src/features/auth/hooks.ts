'use client'

import { useAuth } from '@clerk/nextjs'
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useCryptoStore } from '@/features/crypto/crypto.store'
import type { SyncStatus } from '@/lib/synced-store'
import { useTransactionStore } from '@/store/transaction.store'
import { importLocalData, type ImportResult } from './api'
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

/** Estado combinado de los dos stores en la nube */
export const useCloudStatus = () => {
  const dolar = useTransactionStore(
    useShallow((s) => ({ source: s.source, status: s.status, pendingWrites: s.pendingWrites })),
  )
  const crypto = useCryptoStore(
    useShallow((s) => ({ source: s.source, status: s.status, pendingWrites: s.pendingWrites })),
  )
  const statuses: SyncStatus[] = [dolar.status, crypto.status]

  return {
    isCloud: dolar.source === 'cloud' && crypto.source === 'cloud',
    status: statuses.includes('error')
      ? 'error'
      : statuses.some((s) => s === 'pending' || s === 'loading')
        ? 'loading'
        : ('ready' as const),
    pendingWrites: dolar.pendingWrites + crypto.pendingWrites,
    retry: () => {
      for (const store of [useTransactionStore, useCryptoStore]) {
        if (store.getState().status === 'error') void store.getState().retryCloud()
      }
    },
  }
}

/**
 * Operaciones de este navegador que no están en la cuenta del usuario.
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
  const handled = useSyncStore((s) => (userId ? s.handledIds[userId] : undefined))
  const markHandled = useSyncStore((s) => s.markHandled)

  const ready = isCloud && status === 'ready' && !!userId

  const pending = useMemo((): LocalData => {
    if (!ready) return EMPTY_LOCAL_DATA
    return localNotInCloud(
      {
        dolar: flatten(dolarLocal?.transactions ?? {}),
        crypto: cryptoLocal ?? EMPTY_LOCAL_DATA.crypto,
      },
      { dolar: flatten(dolarCloud), crypto: cryptoCloud },
    )
  }, [ready, dolarLocal, dolarCloud, cryptoLocal, cryptoCloud])

  const unoffered = useMemo(
    () => excludeIds(pending, new Set(handled)),
    [pending, handled],
  )

  /** Sube `data` (por defecto, todo lo pendiente) y recarga la nube */
  const upload = async (data: LocalData = pending): Promise<ImportResult> => {
    const result = await importLocalData(toImportPayload(data))
    if (userId) markHandled(userId, localDataIds(data))
    await Promise.all([
      useTransactionStore.getState().refreshCloud(),
      useCryptoStore.getState().refreshCloud(),
    ])
    return result
  }

  /** "Ahora no": no volver a ofrecer estas operaciones automáticamente */
  const dismiss = () => {
    if (userId) markHandled(userId, localDataIds(unoffered))
  }

  return { pending, unoffered, upload, dismiss }
}
