-- StockPilot v1.9 persistent notification read state
-- Active operational alerts remain visible until resolved, while the bell counts only unread alerts.

create table if not exists public.user_alert_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_key text not null,
  fingerprint text not null,
  seen_at timestamptz not null default now(),
  primary key (user_id, alert_key)
);

create index if not exists user_alert_reads_seen_at_idx on public.user_alert_reads(seen_at desc);

revoke all on public.user_alert_reads from anon;
grant select, insert, update, delete on public.user_alert_reads to authenticated;
alter table public.user_alert_reads enable row level security;

drop policy if exists user_alert_reads_select on public.user_alert_reads;
create policy user_alert_reads_select on public.user_alert_reads
for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists user_alert_reads_insert on public.user_alert_reads;
create policy user_alert_reads_insert on public.user_alert_reads
for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists user_alert_reads_update on public.user_alert_reads;
create policy user_alert_reads_update on public.user_alert_reads
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists user_alert_reads_delete on public.user_alert_reads;
create policy user_alert_reads_delete on public.user_alert_reads
for delete to authenticated
using (user_id = (select auth.uid()));

create or replace view public.operational_alerts
with (security_invoker = true)
as
with settings as (
  select
    coalesce((select alert_missing_barcodes from public.app_settings where setting_key = 'primary'), true) as alert_missing_barcodes,
    coalesce((select fx_stale_days from public.app_settings where setting_key = 'primary'), 14)::integer as fx_stale_days
),
stock_alerts as (
  select
    case when i.quantity_on_hand <= 0 then 'stock-out-' || i.product_id::text else 'stock-low-' || i.product_id::text end as alert_key,
    case when i.quantity_on_hand <= 0 then 'critical' else 'warning' end::text as severity,
    case when i.quantity_on_hand <= 0 then i.name || ' is out of stock' else i.name || ' is low in stock' end::text as title,
    case
      when i.quantity_on_hand <= 0 then 'SKU ' || i.sku || '. Reorder threshold: ' || i.low_stock_threshold::text || '.'
      else i.quantity_on_hand::text || ' units remain. Reorder threshold: ' || i.low_stock_threshold::text || '.'
    end::text as detail,
    'stock'::text as icon,
    concat('qty=', i.quantity_on_hand, '|p=', i.total_purchased, '|s=', i.total_sold, '|t=', i.low_stock_threshold)::text as fingerprint,
    case when i.quantity_on_hand <= 0 then 0 else 1 end::integer as sort_order
  from public.product_inventory i
  where i.quantity_on_hand <= 0 or i.is_low_stock
),
barcode_alerts as (
  select
    'barcode-' || p.id::text as alert_key,
    'info'::text as severity,
    'Barcode missing for ' || p.name as title,
    'SKU ' || p.sku || '. Add a UPC/EAN or internal barcode to speed up purchasing and sales.'::text as detail,
    'barcode'::text as icon,
    concat('missing|updated=', p.updated_at::text)::text as fingerprint,
    2::integer as sort_order
  from public.products p
  cross join settings s
  where s.alert_missing_barcodes and nullif(btrim(coalesce(p.barcode, '')), '') is null
),
currency_codes(code) as (
  values ('GBP'::text), ('USD'::text)
),
fx_alerts as (
  select
    case when r.id is null then 'fx-missing-' || c.code else 'fx-stale-' || c.code end as alert_key,
    case when r.id is null then 'warning' else 'info' end::text as severity,
    case when r.id is null then c.code || ' exchange rate is not configured' else c.code || ' exchange rate may be stale' end::text as title,
    case
      when r.id is null then 'Set the current ' || c.code || ' to GHS rate in Settings before recording ' || c.code || ' transactions.'
      else 'Last updated ' || to_char(r.updated_at at time zone 'UTC', 'DD Mon YYYY HH24:MI') || ' UTC (' || (current_date - r.updated_at::date)::text || ' days ago). Alert threshold: ' || s.fx_stale_days::text || ' days.'
    end::text as detail,
    'fx'::text as icon,
    case when r.id is null then 'missing|threshold=' || s.fx_stale_days::text else 'updated=' || r.updated_at::text || '|threshold=' || s.fx_stale_days::text end::text as fingerprint,
    case when r.id is null then 1 else 2 end::integer as sort_order
  from currency_codes c
  cross join settings s
  left join public.exchange_rates r on r.currency_code::text = c.code
  where r.id is null or (current_date - r.updated_at::date) > s.fx_stale_days
)
select * from stock_alerts
union all
select * from barcode_alerts
union all
select * from fx_alerts;

revoke all on public.operational_alerts from anon;
grant select on public.operational_alerts to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.user_alert_reads;
exception when duplicate_object then null; end $$;
