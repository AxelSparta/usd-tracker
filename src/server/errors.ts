import { z } from 'zod'
import { Prisma } from '@/generated/prisma/client'
import { logError } from './log'

/** Error con status HTTP; el mensaje (en español) llega al usuario en un toast */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

/**
 * Corre una operación pura del dominio: si la línea temporal queda inconsistente,
 * su `Error` pasa a ser un 422 con el mismo mensaje que vería el usuario en local.
 */
export const applyOrReject = <T>(apply: () => T): T => {
  try {
    return apply()
  } catch (error) {
    throw new ApiError(422, error instanceof Error ? error.message : 'Operación inválida.')
  }
}

/** Lee y valida el body JSON; 400 con el primer mensaje de Zod */
export const parseBody = async <T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.output<T>> => {
  const body: unknown = await request.json().catch(() => {
    throw new ApiError(400, 'El cuerpo de la solicitud no es JSON válido.')
  })
  const result = schema.safeParse(body)
  if (!result.success) {
    throw new ApiError(400, result.error.issues[0]?.message ?? 'Datos inválidos.')
  }
  return result.data
}

export const errorResponse = (error: unknown): Response => {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message }, { status: error.status })
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Id duplicado: ya existe (propia, reintento) o pertenece a otro usuario
    if (error.code === 'P2002') {
      return Response.json({ error: 'La operación ya existe.' }, { status: 409 })
    }
    // Conflicto de serialización: otra escritura del mismo usuario en paralelo
    if (error.code === 'P2034') {
      return Response.json(
        { error: 'Otra operación se guardó al mismo tiempo. Reintentá.' },
        { status: 409 },
      )
    }
  }
  logError('api.unexpected', error)
  return Response.json({ error: 'Error inesperado del servidor.' }, { status: 500 })
}

/** `[id]` de la URL: si no es un UUID no puede existir (y Postgres rechazaría el cast) */
export const parseIdParam = async (params: Promise<{ id: string }>): Promise<string> => {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) throw new ApiError(404, 'La operación no existe.')
  return id
}
