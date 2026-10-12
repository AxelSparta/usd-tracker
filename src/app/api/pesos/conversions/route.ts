import { conversionApiSchema } from '@/features/pesos/validations'
import { requireScope } from '@/server/scope'
import { errorResponse, parseBody } from '@/server/errors'
import { logEvent } from '@/server/log'
import { createConversion } from '@/server/pesos-conversions'

/** POST /api/pesos/conversions `{ conversion, ids }` → 201 `[pata pesos, pata dólar]` */
export async function POST(request: Request) {
  try {
    const scope = await requireScope(request)
    const { conversion, ids } = await parseBody(request, conversionApiSchema)
    const legs = await createConversion(scope, conversion, ids)
    logEvent('pesosConversion.created', {
      ...scope,
      conversionId: ids.conversionId,
      direction: conversion.direction,
      dolarOption: conversion.dolarOption,
    })
    return Response.json(legs, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
