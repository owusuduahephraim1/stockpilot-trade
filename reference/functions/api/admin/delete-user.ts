import { z } from 'zod'
import type { Env } from '../../_lib/env'
import { requireAdmin } from '../../_lib/auth'
import { requireAnotherActiveAdmin } from '../../_lib/adminAccounts'
import { badRequest, forbidden, json, unauthorized } from '../../_lib/http'

const schema = z.object({ userId: z.string().uuid() })

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const { admin, user } = await requireAdmin(request, env)
    const parsed = schema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return badRequest('Invalid user account')
    const userId = parsed.data.userId

    if (userId === user.id) return badRequest('Sign in with the replacement Owner/Admin before deleting this account')

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id,full_name,email,role,account_deleted_at')
      .eq('id', userId)
      .maybeSingle()
    if (profileError) return json({ error: profileError.message }, 400)
    if (!profile) return badRequest('Workspace account was not found')
    if (profile.account_deleted_at) return badRequest('This account has already been permanently deleted')

    const { data: authResult, error: authError } = await admin.auth.admin.getUserById(userId)
    if (authError || !authResult.user) return badRequest('Authentication account was not found')
    const bannedUntil = authResult.user.banned_until ? new Date(authResult.user.banned_until).getTime() : 0
    if (!bannedUntil || bannedUntil <= Date.now()) {
      return badRequest('Disable the account before permanently deleting it')
    }

    // Owner/Admin accounts may be retired only after a different active Admin exists.
    // This guarantees the workspace can never be left without an administrative account.
    if (profile.role === 'admin') {
      await requireAnotherActiveAdmin(admin, userId)
    }

    const deletedAt = new Date().toISOString()
    const { error: markError } = await admin
      .from('profiles')
      .update({ account_deleted_at: deletedAt })
      .eq('id', userId)
    if (markError) return json({ error: markError.message }, 400)

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId, false)
    if (deleteError) {
      await admin.from('profiles').update({ account_deleted_at: null }).eq('id', userId)
      return json({ error: deleteError.message }, 400)
    }

    // Preserve the historical profile so old sales, purchases and audit entries continue
    // to show the correct operator/administrator identity after the Auth account is removed.
    await admin.from('activity_logs').insert({
      user_id: user.id,
      action: 'delete',
      entity_type: profile.role === 'admin' ? 'admin_account' : 'staff_account',
      entity_id: userId,
      details: {
        full_name: profile.full_name,
        email: profile.email,
        role: profile.role,
        account_deleted_at: deletedAt,
      },
    })

    return json({ ok: true })
  } catch (error) {
    const message = (error as Error).message
    if (message === 'UNAUTHORIZED') return unauthorized()
    if (message === 'FORBIDDEN') return forbidden()
    if (message === 'LAST_ACTIVE_ADMIN') return badRequest('Create and verify another Owner/Admin before permanently deleting this account')
    if (message.startsWith('ADMIN_LOOKUP_FAILED:')) return json({ error: 'Could not verify the active Owner/Admin accounts' }, 500)
    return json({ error: 'Could not permanently delete workspace account' }, 500)
  }
}
