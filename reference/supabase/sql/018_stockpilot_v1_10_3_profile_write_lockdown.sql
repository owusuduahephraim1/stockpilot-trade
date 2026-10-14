-- StockPilot v1.10.3 profile write lockdown
-- User/role changes are mediated by authenticated Cloudflare admin endpoints that
-- enforce last-Owner/Admin and disabled-account safeguards. Browser Supabase
-- clients need read-only profile access and must not bypass those invariants.

revoke all on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;

drop policy if exists profiles_admin_update on public.profiles;

-- Keep the membership gate and own/Admin SELECT policy authoritative for reads.
-- Server-side secret/service-role operations continue to bypass RLS as intended.
