import type { Instrumentation } from 'next'
import { logError } from '@/server/log'

/**
 * Errores del server que no atrapa ningún handler (render de páginas, proxy). Los de
 * `/api/*` ya los registra `errorResponse` como `api.unexpected`. No se loguean headers:
 * llevan la cookie de sesión.
 */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  logError('request.error', error, {
    digest: (error as { digest?: string }).digest,
    method: request.method,
    path: request.path,
    routePath: context.routePath,
    routeType: context.routeType,
  })
}
