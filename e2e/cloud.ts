import { neon } from '@neondatabase/serverless'

/**
 * E2E con sesión: usan la instancia de desarrollo de Clerk y una base de Neon que **no** sea
 * la de producción (los tests borran los datos del usuario de prueba antes de cada caso).
 * Sin estas variables los specs `*.cloud.spec.ts` se saltean.
 */
export const hasCloudEnv = Boolean(
  process.env.CLERK_SECRET_KEY &&
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.DATABASE_URL,
)

/** `+clerk_test`: dirección de prueba de Clerk (no manda mails reales) */
export const E2E_EMAIL = process.env.E2E_CLERK_USER_EMAIL ?? 'e2e+clerk_test@example.com'

const clerkApi = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      'content-type': 'application/json',
    },
  })
  if (!response.ok) {
    const body = await response.text()
    if (body.includes('form_param_unknown')) {
      throw new Error(
        'Clerk no acepta usuarios con email: habilitá "Email address" en el Dashboard de la ' +
          'instancia de desarrollo (User & authentication → Email, phone, username).',
      )
    }
    throw new Error(`Clerk ${init?.method ?? 'GET'} ${path}: ${response.status} ${body}`)
  }
  return response.json() as Promise<T>
}

/** Id del usuario de prueba; lo crea (sin contraseña) la primera vez */
export const ensureTestUser = async (): Promise<string> => {
  const [existing] = await clerkApi<{ id: string }[]>(
    `/users?email_address=${encodeURIComponent(E2E_EMAIL)}`,
  )
  if (existing) return existing.id
  const created = await clerkApi<{ id: string }>('/users', {
    method: 'POST',
    body: JSON.stringify({ email_address: [E2E_EMAIL], skip_password_requirement: true }),
  })
  return created.id
}

/** Borra todo lo del usuario de prueba (las operaciones caen en cascada con la fila `User`) */
export const resetCloudData = async (userId: string) => {
  const sql = neon(process.env.DATABASE_URL!)
  await sql`DELETE FROM "User" WHERE id = ${userId}`
}
