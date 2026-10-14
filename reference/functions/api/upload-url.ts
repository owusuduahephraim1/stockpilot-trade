import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { z } from 'zod'
import type { Env } from '../_lib/env'
import { requireUser } from '../_lib/auth'
import { badRequest, forbidden, json, unauthorized } from '../_lib/http'

const bodySchema = z.object({
  filename: z.string().min(1).max(180),
  contentType: z.enum(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']),
  category: z.enum(['invoices', 'receipts', 'delivery-notes']).default('invoices'),
  size: z.number().int().positive().max(10 * 1024 * 1024),
})

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const { user } = await requireUser(request, env)
    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Invalid upload request')

    const clean = parsed.data.filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    const key = `${parsed.data.category}/${new Date().toISOString().slice(0,10)}/${user.id}/${crypto.randomUUID()}-${clean}`
    const s3 = new S3Client({
      region: 'auto',
      endpoint: env.R2_ENDPOINT,
      credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
    })
    const command = new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      ContentType: parsed.data.contentType,
      ContentLength: parsed.data.size,
    })
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 })
    return json({ uploadUrl, key, expiresIn: 300 })
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') return unauthorized()
    if ((error as Error).message === 'FORBIDDEN') return forbidden()
    return json({ error: 'Could not generate upload URL' }, 500)
  }
}
