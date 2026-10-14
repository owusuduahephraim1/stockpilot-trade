import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { z } from 'zod'
import type { Env } from '../_lib/env'
import { requireUser } from '../_lib/auth'
import { badRequest, forbidden, json, unauthorized } from '../_lib/http'

const schema = z.object({ key: z.string().min(1).max(1024) })
const allowedCategories = new Set(['invoices', 'receipts', 'delivery-notes'])

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const { user, profile, admin } = await requireUser(request, env)
    const parsed = schema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return badRequest('Invalid document key')

    const key = parsed.data.key
    if (key.includes('..') || key.startsWith('/') || /[\0\r\n]/.test(key)) return badRequest('Invalid document key')

    const segments = key.split('/')
    if (segments.length < 4 || !allowedCategories.has(segments[0])) return badRequest('Invalid document key')
    const ownerId = segments[2]
    if (profile.role !== 'admin' && ownerId !== user.id) return forbidden('Only the uploader or Owner/Admin can clean this document')

    const [{ data: purchase, error: purchaseError }, { data: sale, error: saleError }] = await Promise.all([
      admin.from('purchases').select('id').eq('invoice_url', key).limit(1).maybeSingle(),
      admin.from('sales').select('id').eq('receipt_url', key).limit(1).maybeSingle(),
    ])
    if (purchaseError || saleError) return json({ error: 'Could not validate document cleanup' }, 500)
    if (purchase || sale) return json({ deleted: false, linked: true })

    const s3 = new S3Client({
      region: 'auto',
      endpoint: env.R2_ENDPOINT,
      credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
    })
    await s3.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }))
    return json({ deleted: true, linked: false })
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') return unauthorized()
    if ((error as Error).message === 'FORBIDDEN') return forbidden()
    return json({ error: 'Could not clean unlinked document' }, 500)
  }
}
