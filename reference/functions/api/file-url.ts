import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { Env } from '../_lib/env'
import { requireUser } from '../_lib/auth'
import { badRequest, forbidden, json, unauthorized } from '../_lib/http'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const { admin } = await requireUser(request, env)
    const key = new URL(request.url).searchParams.get('key')
    if (!key || key.length > 1024 || key.includes('..') || key.startsWith('/') || /[\0\r\n]/.test(key)) return badRequest('Invalid key')

    const [{ data: purchase, error: purchaseError }, { data: sale, error: saleError }] = await Promise.all([
      admin.from('purchases').select('id').eq('invoice_url', key).limit(1).maybeSingle(),
      admin.from('sales').select('id').eq('receipt_url', key).limit(1).maybeSingle(),
    ])
    if (purchaseError || saleError) return json({ error: 'Could not validate document access' }, 500)
    if (!purchase && !sale) return forbidden('Document is not linked to an accessible StockPilot transaction')

    const s3 = new S3Client({
      region: 'auto', endpoint: env.R2_ENDPOINT,
      credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
    })
    const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }), { expiresIn: 300 })
    return json({ url, expiresIn: 300 })
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') return unauthorized()
    return json({ error: 'Could not generate file URL' }, 500)
  }
}
