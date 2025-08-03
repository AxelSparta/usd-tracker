import prisma from '@/lib/prisma'
import { DeletedObjectJSON, UserJSON } from '@clerk/nextjs/server'

export const createUser = async (userData: UserJSON) => {
  const data = {
    clerkUserId: userData.id,
    email: userData.email_addresses[0]?.email_address || '',
    createdAt: new Date(userData.created_at),
    updatedAt: new Date(userData.updated_at)
  }

  const user = await prisma.user.create({
    data
  })
  return user
}

export const deleteUser = async (userData: DeletedObjectJSON) => {
  const clerkUserId = userData.id
  const user = await prisma.user.delete({
    where: { clerkUserId }
  })
  return user
}

export const updateUser = async (userData: UserJSON) => {
  const clerkUserId = userData.id
  const data = {
    clerkUserId: userData.id,
    email: userData.email_addresses[0]?.email_address || '',
    createdAt: new Date(userData.created_at),
    updatedAt: new Date(userData.updated_at)
  }
  prisma.user.update({
    where: { clerkUserId },
    data
  })
}
