import { auth } from '@clerk/nextjs/server'
import { ApiError } from './errors'

/** userId de Clerk de la sesión actual; 401 si no hay sesión */
export const requireUserId = async (): Promise<string> => {
  const { userId } = await auth()
  if (!userId) throw new ApiError(401, 'Iniciá sesión para sincronizar tus datos.')
  return userId
}
