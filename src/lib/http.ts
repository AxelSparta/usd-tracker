/** Error HTTP de nuestras APIs (`/api/*`): conserva el status y el mensaje en español del server. */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

/**
 * `fetch` a un route handler propio. Lanza `ApiRequestError` con el `error` del body
 * si la respuesta no es OK, o con un mensaje genérico si no hubo red.
 */
export const requestJson = async <T>(
  url: string,
  init?: Omit<RequestInit, 'body'> & { body?: unknown },
): Promise<T> => {
  const { body, ...rest } = init ?? {}
  let response: Response
  try {
    response = await fetch(url, {
      ...rest,
      ...(body !== undefined && {
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json', ...rest.headers },
      }),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiRequestError('No hay conexión con el servidor.', 0)
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new ApiRequestError(data?.error ?? `Error ${response.status}`, response.status)
  }
  return response.status === 204 ? (undefined as T) : response.json()
}
