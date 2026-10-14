import type { Env } from '../../_lib/env'
import { requireAdmin } from '../../_lib/auth'
import { forbidden, json, unauthorized } from '../../_lib/http'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const { admin } = await requireAdmin(request, env)
    const authUsers: any[] = []
    const perPage = 100
    for (let page = 1; page <= 100; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
      if (error) return json({ error: error.message }, 400)
      authUsers.push(...data.users)
      if (data.users.length < perPage) break
    }

    const { data: profiles, error: profilesError } = await admin
      .from('profiles')
      .select('id,full_name,email,role,created_at,account_deleted_at')
      .is('account_deleted_at', null)
    if (profilesError) return json({ error: profilesError.message }, 400)

    const map = new Map((profiles || []).map((p: any) => [p.id, p]))
    // An Auth identity is not a StockPilot user until an Owner/Admin provisions a
    // matching active profile. This prevents direct/self-service Auth signups from
    // appearing as manageable workspace accounts.
    const users = authUsers
      .filter((u) => map.has(u.id))
      .map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        banned_until: u.banned_until,
        ...map.get(u.id),
      }))
    return json({ users })
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') return unauthorized()
    if ((error as Error).message === 'FORBIDDEN') return forbidden()
    return json({ error: 'Could not list users' }, 500)
  }
}
