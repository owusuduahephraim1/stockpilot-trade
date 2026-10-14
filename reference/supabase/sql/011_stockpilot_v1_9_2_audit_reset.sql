-- StockPilot v1.9.2: owner/admin-only destructive audit trail reset.
-- Ordinary application roles keep SELECT-only access to activity_logs.

create or replace function public.reset_activity_logs(confirm_phrase text)
returns bigint
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  deleted_count bigint := 0;
begin
  if not app_private.is_admin() then
    raise exception 'Administrator access required';
  end if;

  if confirm_phrase is distinct from 'DELETE ALL LOGS' then
    raise exception 'Confirmation phrase does not match';
  end if;

  delete from public.activity_logs;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.reset_activity_logs(text) from public;
revoke all on function public.reset_activity_logs(text) from anon;
grant execute on function public.reset_activity_logs(text) to authenticated;
