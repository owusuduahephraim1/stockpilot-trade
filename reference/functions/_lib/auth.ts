import { createClient } from '@supabase/supabase-js'
import type { Env } from './env'

export async function requireUser(request: Request, env: Env) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
  if (!token) throw new Error('UNAUTHORIZED')

  const serverKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
  if (!serverKey) throw new Error('SERVER_CONFIGURATION')

  const admin = createClient(env.VITE_SUPABASE_URL, serverKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new Error('UNAUTHORIZED')

  // Access tokens can remain cryptographically valid for a short period after an
  // administrator disables an account. Re-read the authoritative Auth record so
  // protected server endpoints stop accepting a banned user immediately.
  const { data: account, error: accountError } = await admin.auth.admin.getUserById(data.user.id)
  if (accountError || !account.user) throw new Error('UNAUTHORIZED')
  const bannedUntil = account.user.banned_until ? new Date(account.user.banned_until) : null
  if (bannedUntil && Number.isFinite(bannedUntil.getTime()) && bannedUntil.getTime() > Date.now()) {
    throw new Error('UNAUTHORIZED')
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id,email,full_name,role,account_deleted_at')
    .eq('id', data.user.id)
    .single()
  if (profileError || !profile || profile.account_deleted_at) throw new Error('UNAUTHORIZED')
  return { user: data.user, profile, admin }
}

export async function requireAdmin(request: Request, env: Env) {
  const ctx = await requireUser(request, env)
  if (ctx.profile.role !== 'admin') throw new Error('FORBIDDEN')
  return ctx
}
