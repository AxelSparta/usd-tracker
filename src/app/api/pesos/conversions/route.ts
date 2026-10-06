import { conversionApiSchema } from '@/features/pesos/validations'
import { requireUserId } from '@/server/auth'
import { errorResponse, parseBody } from '@/server/errors'
import { logEvent } from '@/server/log'
import { createConversion } from '@/server/pesos-conversions'

/** POST /api/pesos/conversions `{ conversion, ids }` → 201 `[pata pesos, pata dólar]` */
export async function POST(request: Request) {
  try {
    const userId = await requireUserId()
    const { conversion, ids } = await parseBody(request, conversionApiSchema)
    const legs = await createConversion(userId, conversion, ids)
    logEvent('pesosConversion.created', {
      userId,
      conversionId: ids.conversionId,
      direction: conversion.direction,
      dolarOption: conversion.dolarOption,
    })
    return Response.json(legs, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
