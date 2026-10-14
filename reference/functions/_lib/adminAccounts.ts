/**
 * Administrative account helpers used by destructive user-management actions.
 *
 * StockPilot supports more than one Owner/Admin. These helpers intentionally
 * count only accounts that are both:
 *   1. linked to a non-deleted `profiles` row with role = admin, and
 *   2. still present and not banned in Supabase Auth.
 *
 * This prevents an old historical Admin profile from being mistaken for a
 * usable recovery account after that person's Auth identity has been removed.
 */
export async function getActiveAdminIds(admin: any): Promise<Set<string>> {
  const { data: profiles, error: profilesError } = await admin
    .from('profiles')
    .select('id,role,account_deleted_at')
    .eq('role', 'admin')
    .is('account_deleted_at', null)

  if (profilesError) throw new Error(`ADMIN_LOOKUP_FAILED:${profilesError.message}`)

  // Re-apply the role/deletion checks client-side as a defensive safeguard.
  // The Supabase query above already performs these filters in production.
  const candidateIds = new Set<string>(
    (profiles || [])
      .filter((profile: any) => profile.role === 'admin' && !profile.account_deleted_at)
      .map((profile: any) => profile.id),
  )

  const activeIds = new Set<string>()
  if (!candidateIds.size) return activeIds

  const perPage = 100
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`ADMIN_LOOKUP_FAILED:${error.message}`)

    for (const authUser of data.users) {
      if (!candidateIds.has(authUser.id)) continue
      const bannedUntil = authUser.banned_until ? new Date(authUser.banned_until).getTime() : 0
      const isDisabled = Number.isFinite(bannedUntil) && bannedUntil > Date.now()
      if (!isDisabled) activeIds.add(authUser.id)
    }

    if (data.users.length < perPage) break
  }

  return activeIds
}

export async function requireAnotherActiveAdmin(admin: any, targetUserId: string) {
  const activeIds = await getActiveAdminIds(admin)
  activeIds.delete(targetUserId)
  if (activeIds.size < 1) {
    throw new Error('LAST_ACTIVE_ADMIN')
  }
}
