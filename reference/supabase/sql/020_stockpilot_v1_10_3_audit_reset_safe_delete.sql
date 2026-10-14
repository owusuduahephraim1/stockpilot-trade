-- StockPilot v1.10.3: repair Owner/Admin audit reset under Supabase safe-delete guard.
-- Keep execution as SECURITY INVOKER so table grants, RLS, active-workspace checks,
-- and the Admin-only delete policy remain authoritative.

create or replace function public.reset_activity_logs(confirm_phrase text)
returns bigint
language plpgsql
security invoker
set search_path = public, app_private, pg_temp
as $$
declare
  deleted_count bigint := 0;
begin
  if confirm_phrase is distinct from 'DELETE ALL LOGS' then
    raise exception 'Confirmation phrase does not match';
  end if;

  if not app_private.is_admin() then
    raise exception 'Administrator access required';
  end if;

  -- Supabase's safe-delete guard rejects DELETE without a WHERE clause.
  -- activity_logs.id is the non-null primary key, so this intentionally targets
  -- every retained audit row while RLS still limits execution to an active Admin.
  delete from public.activity_logs
  where id is not null;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.reset_activity_logs(text) from public;
revoke all on function public.reset_activity_logs(text) from anon;
grant execute on function public.reset_activity_logs(text) to authenticated;
