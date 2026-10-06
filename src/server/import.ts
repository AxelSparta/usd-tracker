import { z } from 'zod'
import { assertDolarShape, groupTransactions, validateAllGroups } from '@/domain/transactions'
import { assertCryptoShape, validateCryptoTimelines } from '@/features/crypto/operations'
import type { Coin } from '@/features/crypto/types'
import {
  coinApiSchema,
  cryptoTransactionFields,
} from '@/features/crypto/validations'
import { assertConversionsComplete } from '@/features/pesos/conversions'
import { assertPesosShape, validatePesosTimeline } from '@/features/pesos/operations'
import { createPesosMovementApiSchema } from '@/features/pesos/validations'
import { assertUsdtSwapsComplete } from '@/features/usdt-swaps/operations'
import { createTransactionApiSchema } from '@/validations/transaction'
import { loadCryptoState } from './crypto-transactions'
import { loadPesosState } from './pesos-movements'
import { withUserTransaction } from './db'
import { ApiError, applyOrReject } from './errors'
import {
  toCryptoTransactionData,
  toDolarTransaction,
  toDolarTransactionData,
  toPesosMovementData,
} from './mappers'

/**
 * Subida de los datos locales a la nube (Fase 3). Regla de conflictos: **la nube manda**.
 * Lo local solo agrega operaciones nuevas; un id que ya existe en la nube se saltea
 * (gana la versión de la nube) y lo mismo con los metadatos de monedas ya conocidas.
 * Idempotente: subir dos veces lo mismo no duplica nada.
 */

const MAX_ITEMS = 5000

export const importSchema = z
  .object({
    dolar: z
      .array(
        createTransactionApiSchema.extend({
          usdtSwapId: z.uuid('Id inválido').optional(),
          conversionId: z.uuid('Id inválido').optional(),
        }),
      )
      .max(MAX_ITEMS),
    crypto: z.object({
      transactions: z
        .array(
          cryptoTransactionFields.extend({
            id: z.uuid('Id inválido'),
            swapId: z.uuid('Id inválido').optional(),
            usdtSwapId: z.uuid('Id inválido').optional(),
          }),
        )
        .max(MAX_ITEMS),
      coins: z.record(z.string(), coinApiSchema),
    }),
    // Opcional: un cliente anterior a la Fase 8 no lo manda
    pesos: z
      .array(createPesosMovementApiSchema.extend({ conversionId: z.uuid('Id inválido').optional() }))
      .max(MAX_ITEMS)
      .default([]),
  })
  .refine(
    (d) => d.crypto.transactions.every((t) => d.crypto.coins[t.coinId]?.id === t.coinId),
    { message: 'Falta la moneda de alguna operación cripto.' },
  )

export type ImportInput = z.output<typeof importSchema>

export type ImportResult = {
  dolar: { created: number; skipped: number }
  crypto: { created: number; skipped: number }
  pesos: { created: number; skipped: number }
}

export const importLocalData = (userId: string, input: ImportInput) =>
  withUserTransaction(userId, async (db): Promise<ImportResult> => {
    const existingDolar = (
      await db.dolarTransaction.findMany({ where: { userId } })
    ).map(toDolarTransaction)
    const existingCrypto = await loadCryptoState(db, userId)
    const existingPesos = await loadPesosState(db, userId)
    const known = new Set([
      ...existingDolar.map((t) => t.id),
      ...existingCrypto.transactions.map((t) => t.id),
      ...existingPesos.movements.map((m) => m.id),
    ])

    const newDolar = input.dolar.filter((t) => !known.has(t.id))
    const newCrypto = input.crypto.transactions.filter((t) => !known.has(t.id))
    const newPesos = input.pesos.filter((m) => !known.has(m.id))
    // Metadatos: los de la nube pisan a los locales
    const coins: Record<string, Coin> = { ...input.crypto.coins, ...existingCrypto.coins }

    // Juntar dos líneas temporales válidas da otra válida, pero el server no confía en el cliente
    // Resultados de trades: en el dólar cripto, sin comisión ni enlaces de intercambio
    applyOrReject(() => {
      newDolar.forEach(assertDolarShape)
      newCrypto.forEach(assertCryptoShape)
      newPesos.forEach(assertPesosShape)
    })
    // Cada intercambio USDT necesita sus dos patas (una sola dejaría un saldo sin contraparte)
    applyOrReject(() =>
      assertUsdtSwapsComplete(
        [...existingDolar, ...newDolar],
        [...existingCrypto.transactions, ...newCrypto],
      ),
    )
    // Lo mismo con las conversiones de pesos: una pata en cada módulo, con el mismo monto en ARS
    applyOrReject(() =>
      assertConversionsComplete(
        [...existingDolar, ...newDolar],
        [...existingPesos.movements, ...newPesos],
      ),
    )
    applyOrReject(() => validateAllGroups(groupTransactions([...existingDolar, ...newDolar])))
    applyOrReject(() =>
      validateCryptoTimelines({
        transactions: [...existingCrypto.transactions, ...newCrypto],
        coins,
      }),
    )
    applyOrReject(() => validatePesosTimeline([...existingPesos.movements, ...newPesos]))
    if (newDolar.length + newCrypto.length + newPesos.length === 0) {
      return {
        dolar: { created: 0, skipped: input.dolar.length },
        crypto: { created: 0, skipped: input.crypto.transactions.length },
        pesos: { created: 0, skipped: input.pesos.length },
      }
    }

    // skipDuplicates: un id que choca con una operación de otro usuario se saltea sin revelarla
    const dolar = await db.dolarTransaction.createMany({
      data: newDolar.map((tx) => ({ id: tx.id, userId, ...toDolarTransactionData(tx) })),
      skipDuplicates: true,
    })
    const crypto = await db.cryptoTransaction.createMany({
      data: newCrypto.map((tx) => {
        const coin = coins[tx.coinId]
        if (!coin) throw new ApiError(400, 'Falta la moneda de alguna operación cripto.')
        return { id: tx.id, userId, ...toCryptoTransactionData(tx, coin) }
      }),
      skipDuplicates: true,
    })
    const pesos = await db.pesosMovement.createMany({
      data: newPesos.map((m) => ({ id: m.id, userId, ...toPesosMovementData(m) })),
      skipDuplicates: true,
    })

    return {
      dolar: { created: dolar.count, skipped: input.dolar.length - dolar.count },
      crypto: {
        created: crypto.count,
        skipped: input.crypto.transactions.length - crypto.count,
      },
      pesos: { created: pesos.count, skipped: input.pesos.length - pesos.count },
    }
  })
