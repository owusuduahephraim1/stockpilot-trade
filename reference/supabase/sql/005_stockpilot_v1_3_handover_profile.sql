-- StockPilot v1.3 Handover Profile and Alert Preferences
-- Additive migration. Existing products and transactions are unchanged.

create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text unique not null default 'primary' check (setting_key = 'primary'),
  business_name text not null default 'StockPilot',
  business_phone text,
  business_email text,
  business_address text,
  receipt_footer text,
  default_label_copies integer not null default 1 check (default_label_copies between 1 and 50),
  alert_missing_barcodes boolean not null default true,
  fx_stale_days integer not null default 14 check (fx_stale_days between 1 and 365),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings(setting_key,business_name,receipt_footer)
values('primary','StockPilot','Thank you for your business.')
on conflict(setting_key) do nothing;

create index if not exists app_settings_updated_by_idx on public.app_settings(updated_by);

drop trigger if exists app_settings_set_updated_at on public.app_settings;
create trigger app_settings_set_updated_at before update on public.app_settings
for each row execute function public.set_updated_at();

drop trigger if exists app_settings_activity_log on public.app_settings;
create trigger app_settings_activity_log after insert or update or delete on public.app_settings
for each row execute function app_private.log_activity();

grant select,insert,update on public.app_settings to authenticated;
revoke all on public.app_settings from anon;
alter table public.app_settings enable row level security;

drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings for select to authenticated using(true);

drop policy if exists app_settings_admin_insert on public.app_settings;
create policy app_settings_admin_insert on public.app_settings for insert to authenticated
with check((select app_private.is_admin()));

drop policy if exists app_settings_admin_update on public.app_settings;
create policy app_settings_admin_update on public.app_settings for update to authenticated
using((select app_private.is_admin())) with check((select app_private.is_admin()));

do $$ begin
  alter publication supabase_realtime add table public.app_settings;
exception when duplicate_object then null; end $$;
