/**
 * Logs del server: una línea JSON por evento en stdout/stderr, que Vercel guarda y
 * permite filtrar por `event` (p. ej. `"event":"dolar.created"`). Sin servicio externo;
 * si más adelante se suma Sentry, se engancha acá y en `src/instrumentation.ts`.
 *
 * Nunca loguear montos, headers ni cookies: solo ids opacos y datos de la operación
 * que sirven para diagnosticar (tipo, moneda, cantidades de filas).
 */

type LogFields = Record<string, string | number | boolean | null | undefined>

const line = (level: 'info' | 'error', event: string, fields: LogFields) =>
  JSON.stringify({ level, event, time: new Date().toISOString(), ...fields })

/** Evento de negocio (alta, edición, borrado, importación) */
export const logEvent = (event: string, fields: LogFields = {}): void => {
  console.info(line('info', event, fields))
}

/** Error inesperado, con mensaje y stack para encontrarlo en los logs */
export const logError = (event: string, error: unknown, fields: LogFields = {}): void => {
  const detail =
    error instanceof Error
      ? { error: error.message, name: error.name, stack: error.stack }
      : { error: String(error) }
  console.error(line('error', event, { ...detail, ...fields }))
}
