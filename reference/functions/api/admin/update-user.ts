import { z } from 'zod'
import type { Env } from '../../_lib/env'
import { requireAdmin } from '../../_lib/auth'
import { requireAnotherActiveAdmin } from '../../_lib/adminAccounts'
import { badRequest, forbidden, json, unauthorized } from '../../_lib/http'

const schema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['admin','staff']).optional(),
  disabled: z.boolean().optional(),
  password: z.string().min(8).max(128).optional(),
})

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const { admin, user } = await requireAdmin(request, env)
    const parsed = schema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Invalid request')

    const actionCount = [
      parsed.data.role !== undefined,
      parsed.data.disabled !== undefined,
      parsed.data.password !== undefined,
    ].filter(Boolean).length
    if (actionCount !== 1) return badRequest('Submit exactly one user-management action at a time')

    const { data: target, error: targetError } = await admin
      .from('profiles')
      .select('id,role,account_deleted_at')
      .eq('id', parsed.data.userId)
      .maybeSingle()
    if (targetError) return json({ error: targetError.message }, 400)
    if (!target || target.account_deleted_at) return badRequest('User account was not found')

    if (parsed.data.userId === user.id && parsed.data.disabled) return badRequest('Sign in with the replacement Owner/Admin before disabling this account')
    if (parsed.data.userId === user.id && parsed.data.password) return badRequest('Use your signed-in account to change your own password')
    if (parsed.data.userId === user.id && parsed.data.role && parsed.data.role !== target.role) return badRequest('Sign in with another Owner/Admin before changing this account role')

    if (parsed.data.role !== undefined) {
      if (parsed.data.role === target.role) return json({ ok: true })

      // Demoting an Admin is allowed only when another active Admin remains available.
      if (target.role === 'admin' && parsed.data.role === 'staff') {
        await requireAnotherActiveAdmin(admin, parsed.data.userId)
      }

      const { error } = await admin.from('profiles').update({ role: parsed.data.role }).eq('id', parsed.data.userId)
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true })
    }

    if (parsed.data.disabled !== undefined) {
      // Disabling an Admin is a valid ownership-handover step, but only after another
      // active Owner/Admin account exists. Staff accounts do not need this safeguard.
      if (target.role === 'admin' && parsed.data.disabled) {
        await requireAnotherActiveAdmin(admin, parsed.data.userId)
      }

      const { error } = await admin.auth.admin.updateUserById(parsed.data.userId, {
        ban_duration: parsed.data.disabled ? '876000h' : 'none',
      })
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true })
    }

    const { error } = await admin.auth.admin.updateUserById(parsed.data.userId, {
      password: parsed.data.password!,
    })
    if (error) return json({ error: error.message }, 400)
    return json({ ok: true })
  } catch (error) {
    const message = (error as Error).message
    if (message === 'UNAUTHORIZED') return unauthorized()
    if (message === 'FORBIDDEN') return forbidden()
    if (message === 'LAST_ACTIVE_ADMIN') return badRequest('Create and verify another Owner/Admin before removing access from this account')
    if (message.startsWith('ADMIN_LOOKUP_FAILED:')) return json({ error: 'Could not verify the active Owner/Admin accounts' }, 500)
    return json({ error: 'Could not update user' }, 500)
  }
}
