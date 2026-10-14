-- StockPilot v1.10.3 final workspace access hardening
-- Production access is provisioned by an Owner/Admin. A Supabase-authenticated
-- identity alone must never imply membership in the StockPilot workspace.

-- Public/self-service Auth signups must not automatically become Staff users.
-- Controlled user creation is performed by /api/admin/create-user, which creates
-- the Auth identity and then explicitly provisions the public.profiles row.
drop trigger if exists on_auth_user_created on auth.users;

create or replace function app_private.is_workspace_user()
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.id = auth.uid()
      and p.account_deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
  );
$$;

revoke all on function app_private.is_workspace_user() from public, anon;
grant execute on function app_private.is_workspace_user() to authenticated;

-- Admin status is valid only while the account is an active, provisioned
-- workspace member. This also closes the short JWT lifetime window after an
-- administrator disables an account.
create or replace function app_private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.account_deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
  );
$$;

revoke all on function app_private.is_admin() from public, anon;
grant execute on function app_private.is_admin() to authenticated;

-- Existing policies continue to define Admin-vs-Staff and ownership semantics.
-- These restrictive policies add the non-bypassable prerequisite that the JWT
-- belongs to a currently provisioned, non-disabled StockPilot workspace user.
drop policy if exists profiles_workspace_member_gate on public.profiles;
create policy profiles_workspace_member_gate on public.profiles
  as restrictive for all to authenticated
  using ((select app_private.is_workspace_user()))
  with check ((select app_private.is_workspace_user()));

drop policy if exists products_workspace_member_gate on public.products;
create policy products_workspace_member_gate on public.products
  as restrictive for all to authenticated
  using ((select app_private.is_workspace_user()))
  with check ((select app_private.is_workspace_user()));

drop policy if exists purchases_workspace_member_gate on public.purchases;
create policy purchases_workspace_member_gate on public.purchases
  as restrictive for all to authenticated
  using ((select app_private.is_workspace_user()))
  with check ((select app_private.is_workspace_user()));

drop policy if exists sales_workspace_member_gate on public.sales;
create policy sales_workspace_member_gate on public.sales
  as restrictive for all to authenticated
  using ((select app_private.is_workspace_user()))
  with check ((select app_private.is_workspace_user()));

drop policy if exists customers_workspace_member_gate on public.customers;
create policy customers_workspace_member_gate on public.customers
  as restrictive for all to authenticated
  using ((select app_private.is_workspace_user()))
  with check ((select app_private.is_workspace_user()));

drop policy if exists suppliers_workspace_member_gate on public.suppliers;
create policy suppliers_workspace_member_gate on public.suppliers
  as restrictive for all to authenticated
  using ((select app_private.is_workspace_user()))
  with check ((select app_private.is_workspace_user()));

drop policy if exists exchange_rates_workspace_member_gate on public.exchange_rates;
create policy exchange_rates_workspace_member_gate on public.exchange_rates
  as restrictive for all to authenticated
  using ((select app_private.is_workspace_user()))
  with check ((select app_private.is_workspace_user()));

drop policy if exists app_settings_workspace_member_gate on public.app_settings;
create policy app_settings_workspace_member_gate on public.app_settings
  as restrictive for all to authenticated
  using ((select app_private.is_workspace_user()))
  with check ((select app_private.is_workspace_user()));

drop policy if exists activity_logs_workspace_member_gate on public.activity_logs;
create policy activity_logs_workspace_member_gate on public.activity_logs
  as restrictive for all to authenticated
  using ((select app_private.is_workspace_user()))
  with check ((select app_private.is_workspace_user()));

drop policy if exists user_alert_reads_workspace_member_gate on public.user_alert_reads;
create policy user_alert_reads_workspace_member_gate on public.user_alert_reads
  as restrictive for all to authenticated
  using ((select app_private.is_workspace_user()))
  with check ((select app_private.is_workspace_user()));
