import { WebhookEvent } from '@clerk/nextjs/server'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { decodeWebhook } from '../../libs/webhooks'
import { createUser, deleteUser, updateUser } from '../../models/users'

export async function POST (req: Request) {
  const headerPayload = await headers() // nextjs headers
  let webhookEvent: WebhookEvent
  try {
    webhookEvent = await decodeWebhook({ headerPayload, req })
  } catch (error: Error | any) {
    return NextResponse.json(
      { error: error.message || 'Error decoding header' },
      { status: 400 }
    )
  }

  // CONSOLE LOGGING FOR DEBUGGING
  console.log('Webhook event type:', webhookEvent.type)

  if (webhookEvent.type === 'user.created') {
    try {
      const user = await createUser(webhookEvent.data)
      // CONSOLE LOGGING FOR DEBUGGING
      console.log('User created:', user)
    } catch (error: Error | any) {
      return NextResponse.json(
        { error: error.message || 'Error processing user creation' },
        { status: 400 }
      )
    }
  }
  if (webhookEvent.type === 'user.deleted') {
    try {
      const user = await deleteUser(webhookEvent.data)
      // CONSOLE LOGGING FOR DEBUGGING
      console.log('User deleted:', user)
    } catch (error: Error | any) {
      return NextResponse.json(
        { error: error.message || 'Error processing user deletion' },
        { status: 400 }
      )
    }
  }
  if (webhookEvent.type === 'user.updated') {
    try {
      const user = await updateUser(webhookEvent.data)
      // CONSOLE LOGGING FOR DEBUGGING
      console.log('User updated:', user)
    } catch (error: Error | any) {
      return NextResponse.json(
        { error: error.message || 'Error processing user update' },
        { status: 400 }
      )
    }
  }

  return NextResponse.json({ message: 'Webhook received' }, { status: 200 })
}
