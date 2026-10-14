import { z } from 'zod'
import type { Env } from '../../_lib/env'
import { requireAdmin } from '../../_lib/auth'
import { badRequest, forbidden, json, unauthorized } from '../../_lib/http'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  full_name: z.string().min(2).max(100),
  role: z.enum(['admin','staff']).default('staff'),
})

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const { admin } = await requireAdmin(request, env)
    const parsed = schema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Invalid user data')
    const { data, error } = await admin.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: { full_name: parsed.data.full_name },
    })
    if (error || !data.user) return json({ error: error?.message || 'User creation failed' }, 400)

    const { error: profileError } = await admin.from('profiles').upsert({
      id: data.user.id,
      email: data.user.email || parsed.data.email,
      full_name: parsed.data.full_name,
      role: parsed.data.role,
    }, { onConflict: 'id' })

    if (profileError) {
      await admin.auth.admin.deleteUser(data.user.id).catch(() => undefined)
      return json({ error: 'User account could not be linked to the StockPilot workspace' }, 500)
    }

    return json({ user: { id: data.user.id, email: data.user.email, role: parsed.data.role } }, 201)
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') return unauthorized()
    if ((error as Error).message === 'FORBIDDEN') return forbidden()
    return json({ error: 'Could not create user' }, 500)
  }
}
