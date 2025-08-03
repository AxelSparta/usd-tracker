import { WebhookEvent } from '@clerk/nextjs/server'
import { Webhook } from 'svix'

type Props = {
	headerPayload: Headers,
	req: Request
}

export const decodeWebhook = async ({headerPayload, req}: Props ) => {
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET
  if (!WEBHOOK_SECRET) {
    throw new Error('Webhook secret is not defined')
  }

  // from headers get the svix-id, svix_timestamp and svix-signature
  const svixId = headerPayload.get('svix-id')
  const svixTimestamp = headerPayload.get('svix-timestamp')
  const svixSignature = headerPayload.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) 
    throw new Error('Missing required headers')

  // extract the payload from the request body
  const payload = await req.json()
  const body = JSON.stringify(payload)

  const webhook = new Webhook(WEBHOOK_SECRET)
  let evt: WebhookEvent
  try {
    evt = webhook.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature
    }) as WebhookEvent
  } catch (error) {
    throw new Error('Webhook verification failed')
  }
	return evt
}
