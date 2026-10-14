-- StockPilot v1.1 Operational Intelligence
-- Additive upgrade for an existing v1.0 database. Run after 001_stockpilot_setup.sql.

alter table public.profiles add column if not exists phone text;

alter table public.products
  add column if not exists barcode text,
  add column if not exists category text,
  add column if not exists currency text not null default 'GHS' check (currency in ('GHS','GBP','USD')),
  add column if not exists low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  add column if not exists image_url text;
create unique index if not exists products_barcode_unique_idx on public.products(barcode) where barcode is not null and btrim(barcode) <> '';
create index if not exists products_category_idx on public.products(category);

alter table public.purchases
  add column if not exists currency text not null default 'GHS' check (currency in ('GHS','GBP','USD')),
  add column if not exists fx_rate_to_ghs numeric(18,6) not null default 1 check (fx_rate_to_ghs > 0),
  add column if not exists total_cost_ghs numeric(18,2) not null default 0;
update public.purchases set total_cost_ghs=round(total_cost*fx_rate_to_ghs,2) where total_cost_ghs=0 and total_cost<>0;

alter table public.sales
  add column if not exists currency text not null default 'GHS' check (currency in ('GHS','GBP','USD')),
  add column if not exists fx_rate_to_ghs numeric(18,6) not null default 1 check (fx_rate_to_ghs > 0),
  add column if not exists total_amount_ghs numeric(18,2) not null default 0,
  add column if not exists unit_cost_basis_ghs numeric(18,2) not null default 0,
  add column if not exists profit_ghs numeric(18,2) not null default 0;
update public.sales set total_amount_ghs=round(total_amount*fx_rate_to_ghs,2),unit_cost_basis_ghs=unit_cost_basis,profit_ghs=profit where total_amount_ghs=0 and total_amount<>0;

create table if not exists public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  currency_code text unique not null check (currency_code in ('GHS','GBP','USD')),
  rate_to_ghs numeric(18,6) not null check (rate_to_ghs > 0),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.exchange_rates(currency_code,rate_to_ghs) values('GHS',1) on conflict(currency_code) do update set rate_to_ghs=excluded.rate_to_ghs;

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_logs_created_at_idx on public.activity_logs(created_at desc);
create index if not exists activity_logs_user_id_idx on public.activity_logs(user_id);
create index if not exists activity_logs_entity_idx on public.activity_logs(entity_type,entity_id);

create or replace function public.calculate_purchase_total()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  new.total_cost:=round(new.quantity::numeric*new.unit_cost,2);
  new.total_cost_ghs:=round(new.total_cost*new.fx_rate_to_ghs,2);
  return new;
end;$$;

create or replace function public.calculate_sale_total()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare avg_cost_ghs numeric;
begin
  new.total_amount:=round(new.quantity::numeric*new.unit_price,2);
  new.total_amount_ghs:=round(new.total_amount*new.fx_rate_to_ghs,2);
  select case when coalesce(sum(quantity),0)>0 then sum(total_cost_ghs)/sum(quantity) else 0 end into avg_cost_ghs from public.purchases where product_id=new.product_id;
  new.unit_cost_basis_ghs:=round(coalesce(avg_cost_ghs,0),2);
  new.profit_ghs:=round(new.total_amount_ghs-(new.quantity::numeric*new.unit_cost_basis_ghs),2);
  new.unit_cost_basis:=new.unit_cost_basis_ghs;
  new.profit:=new.profit_ghs;
  return new;
end;$$;

create or replace view public.product_inventory with(security_invoker=true) as
with purchase_totals as (
  select product_id,sum(quantity)::integer total_purchased,sum(total_cost_ghs)::numeric(18,2) purchase_cost_ghs,
    case when sum(quantity)>0 then sum(total_cost_ghs)/sum(quantity) else 0 end avg_unit_cost_ghs
  from public.purchases group by product_id
), sale_totals as (
  select product_id,sum(quantity)::integer total_sold,sum(total_amount_ghs)::numeric(18,2) sales_revenue_ghs,sum(profit_ghs)::numeric(18,2) realized_profit_ghs
  from public.sales group by product_id
)
select p.id product_id,p.sku,p.name,p.manufacturer,p.current_cost_price,p.current_selling_price,
  coalesce(pt.total_purchased,0)::integer total_purchased,coalesce(st.total_sold,0)::integer total_sold,
  (coalesce(pt.total_purchased,0)-coalesce(st.total_sold,0))::integer quantity_on_hand,
  round(coalesce(pt.avg_unit_cost_ghs,p.current_cost_price*er.rate_to_ghs,0),2) avg_unit_cost,
  round((coalesce(pt.total_purchased,0)-coalesce(st.total_sold,0))*coalesce(pt.avg_unit_cost_ghs,p.current_cost_price*er.rate_to_ghs,0),2) total_invested,
  case when er.rate_to_ghs is not null then round((coalesce(pt.total_purchased,0)-coalesce(st.total_sold,0))*p.current_selling_price*er.rate_to_ghs,2) else null end potential_revenue,
  round(coalesce(st.realized_profit_ghs,0),2) realized_profit,
  case when er.rate_to_ghs is not null then round((coalesce(pt.total_purchased,0)-coalesce(st.total_sold,0))*((p.current_selling_price*er.rate_to_ghs)-coalesce(pt.avg_unit_cost_ghs,p.current_cost_price*er.rate_to_ghs,0)),2) else null end potential_profit,
  p.barcode,p.category,p.currency,p.low_stock_threshold,
  (coalesce(pt.total_purchased,0)-coalesce(st.total_sold,0))<=p.low_stock_threshold is_low_stock,
  round(coalesce(st.sales_revenue_ghs,0),2) sales_revenue
from public.products p
left join purchase_totals pt on pt.product_id=p.id
left join sale_totals st on st.product_id=p.id
left join public.exchange_rates er on er.currency_code=p.currency;

grant select on public.product_inventory to authenticated;

create or replace view public.stock_movements with(security_invoker=true) as
select pu.id movement_id,pu.product_id,'purchase'::text movement_type,pu.purchase_date movement_date,pu.quantity,pu.unit_cost unit_amount,pu.total_cost total_amount,pu.currency,pu.total_cost_ghs total_amount_ghs,pu.created_by,pu.created_at,pu.notes from public.purchases pu
union all
select s.id,s.product_id,'sale'::text,s.sale_date,-s.quantity,s.unit_price,s.total_amount,s.currency,s.total_amount_ghs,s.created_by,s.created_at,s.notes from public.sales s;
grant select on public.stock_movements to authenticated;

create or replace function app_private.log_activity()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare rid uuid; payload jsonb;
begin
  if tg_op='DELETE' then rid:=old.id;payload:=jsonb_build_object('before',to_jsonb(old));
  elsif tg_op='INSERT' then rid:=new.id;payload:=jsonb_build_object('after',to_jsonb(new));
  else rid:=new.id;payload:=jsonb_build_object('before',to_jsonb(old),'after',to_jsonb(new)); end if;
  insert into public.activity_logs(user_id,action,entity_type,entity_id,details) values((select auth.uid()),lower(tg_op),tg_table_name,rid,payload);
  if tg_op='DELETE' then return old; end if; return new;
end;$$;
revoke all on function app_private.log_activity() from public;

do $$ begin
  drop trigger if exists products_activity_log on public.products;
  create trigger products_activity_log after insert or update or delete on public.products for each row execute function app_private.log_activity();
  drop trigger if exists purchases_activity_log on public.purchases;
  create trigger purchases_activity_log after insert or update or delete on public.purchases for each row execute function app_private.log_activity();
  drop trigger if exists sales_activity_log on public.sales;
  create trigger sales_activity_log after insert or update or delete on public.sales for each row execute function app_private.log_activity();
  drop trigger if exists exchange_rates_activity_log on public.exchange_rates;
  create trigger exchange_rates_activity_log after insert or update or delete on public.exchange_rates for each row execute function app_private.log_activity();
end $$;

grant select,insert,update,delete on public.exchange_rates to authenticated;
grant select on public.activity_logs to authenticated;
revoke all on public.exchange_rates,public.activity_logs from anon;
revoke insert,update,delete on public.activity_logs from authenticated;
alter table public.exchange_rates enable row level security;
alter table public.activity_logs enable row level security;

drop policy if exists exchange_rates_select on public.exchange_rates;
create policy exchange_rates_select on public.exchange_rates for select to authenticated using(true);
drop policy if exists exchange_rates_admin_insert on public.exchange_rates;
create policy exchange_rates_admin_insert on public.exchange_rates for insert to authenticated with check((select app_private.is_admin()));
drop policy if exists exchange_rates_admin_update on public.exchange_rates;
create policy exchange_rates_admin_update on public.exchange_rates for update to authenticated using((select app_private.is_admin())) with check((select app_private.is_admin()));
drop policy if exists exchange_rates_admin_delete on public.exchange_rates;
create policy exchange_rates_admin_delete on public.exchange_rates for delete to authenticated using((select app_private.is_admin()) and currency_code<>'GHS');
drop policy if exists activity_logs_admin_select on public.activity_logs;
create policy activity_logs_admin_select on public.activity_logs for select to authenticated using((select app_private.is_admin()));

do $$ begin alter publication supabase_realtime add table public.exchange_rates; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.activity_logs; exception when duplicate_object then null; end $$;
