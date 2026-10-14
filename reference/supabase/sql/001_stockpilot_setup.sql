-- StockPilot Inventory App - Supabase SQL Setup
-- Run this entire file in Supabase Dashboard > SQL Editor.
-- No local migration command is required.

create extension if not exists pgcrypto;

-- Private helper schema. Keep privileged helper functions out of the exposed public schema.
create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'staff' check (role in ('admin','staff')),
  created_at timestamptz not null default now()
);

create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email,''), '@', 1)),
    'staff'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function app_private.handle_new_user();

revoke all on function app_private.handle_new_user() from public;

-- ---------- products ----------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  name text not null,
  description text,
  manufacturer text,
  current_cost_price numeric(14,2) not null default 0 check (current_cost_price >= 0),
  current_selling_price numeric(14,2) not null default 0 check (current_selling_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

-- ---------- purchases ----------
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_cost numeric(14,2) not null check (unit_cost >= 0),
  total_cost numeric(14,2) not null check (total_cost >= 0),
  purchase_date date not null,
  manufacturer text,
  invoice_url text,
  notes text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

-- ---------- sales ----------
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  total_amount numeric(14,2) not null check (total_amount >= 0),
  unit_cost_basis numeric(14,2) not null default 0 check (unit_cost_basis >= 0),
  profit numeric(14,2) not null default 0,
  sale_date date not null,
  customer_name text,
  receipt_url text,
  notes text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.sales add column if not exists unit_cost_basis numeric(14,2) not null default 0 check (unit_cost_basis >= 0);
alter table public.sales add column if not exists profit numeric(14,2) not null default 0;

create index if not exists purchases_product_id_idx on public.purchases(product_id);
create index if not exists purchases_purchase_date_idx on public.purchases(purchase_date desc);
create index if not exists purchases_created_by_idx on public.purchases(created_by);
create index if not exists sales_product_id_idx on public.sales(product_id);
create index if not exists sales_sale_date_idx on public.sales(sale_date desc);
create index if not exists sales_created_by_idx on public.sales(created_by);

-- Keep entered totals trustworthy.
create or replace function public.calculate_purchase_total()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.total_cost := round((new.quantity::numeric * new.unit_cost), 2);
  return new;
end;
$$;

drop trigger if exists purchases_calculate_total on public.purchases;
create trigger purchases_calculate_total
before insert or update of quantity, unit_cost on public.purchases
for each row execute function public.calculate_purchase_total();

create or replace function public.calculate_sale_total()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
declare
  avg_cost numeric;
begin
  new.total_amount := round((new.quantity::numeric * new.unit_price), 2);
  select case when coalesce(sum(quantity),0) > 0 then sum(total_cost) / sum(quantity) else 0 end
    into avg_cost
  from public.purchases where product_id = new.product_id;
  new.unit_cost_basis := round(coalesce(avg_cost,0), 2);
  new.profit := round(new.total_amount - (new.quantity::numeric * new.unit_cost_basis), 2);
  return new;
end;
$$;

drop trigger if exists sales_calculate_total on public.sales;
create trigger sales_calculate_total
before insert or update of product_id, quantity, unit_price on public.sales
for each row execute function public.calculate_sale_total();

-- Server-side stock guard. This prevents overselling even if the UI is bypassed.
create or replace function public.validate_sale_stock()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  purchased integer;
  sold_other integer;
  available integer;
begin
  select coalesce(sum(quantity),0)::integer into purchased
  from public.purchases where product_id = new.product_id;

  select coalesce(sum(quantity),0)::integer into sold_other
  from public.sales
  where product_id = new.product_id
    and (tg_op = 'INSERT' or id <> new.id);

  available := purchased - sold_other;
  if new.quantity > available then
    raise exception 'Insufficient stock. Available: %, requested: %', available, new.quantity
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists sales_validate_stock on public.sales;
create trigger sales_validate_stock
before insert or update of product_id, quantity on public.sales
for each row execute function public.validate_sale_stock();

-- Inventory view avoids purchase/sales join multiplication by aggregating first.
create or replace view public.product_inventory
with (security_invoker = true)
as
with purchase_totals as (
  select
    product_id,
    sum(quantity)::integer as total_purchased,
    sum(total_cost)::numeric(14,2) as purchase_cost,
    case when sum(quantity) > 0 then sum(total_cost) / sum(quantity) else 0 end as avg_unit_cost
  from public.purchases
  group by product_id
),
sale_totals as (
  select
    product_id,
    sum(quantity)::integer as total_sold,
    sum(total_amount)::numeric(14,2) as sales_revenue,
    sum(profit)::numeric(14,2) as realized_profit
  from public.sales
  group by product_id
)
select
  p.id as product_id,
  p.sku,
  p.name,
  p.manufacturer,
  p.current_cost_price,
  p.current_selling_price,
  coalesce(pt.total_purchased,0)::integer as total_purchased,
  coalesce(st.total_sold,0)::integer as total_sold,
  (coalesce(pt.total_purchased,0) - coalesce(st.total_sold,0))::integer as quantity_on_hand,
  round(coalesce(pt.avg_unit_cost, p.current_cost_price, 0), 2) as avg_unit_cost,
  round((coalesce(pt.total_purchased,0) - coalesce(st.total_sold,0)) * coalesce(pt.avg_unit_cost, p.current_cost_price, 0), 2) as total_invested,
  round((coalesce(pt.total_purchased,0) - coalesce(st.total_sold,0)) * p.current_selling_price, 2) as potential_revenue,
  round(coalesce(st.realized_profit,0), 2) as realized_profit,
  round((coalesce(pt.total_purchased,0) - coalesce(st.total_sold,0)) * (p.current_selling_price - coalesce(pt.avg_unit_cost, p.current_cost_price, 0)), 2) as potential_profit
from public.products p
left join purchase_totals pt on pt.product_id = p.id
left join sale_totals st on st.product_id = p.id;

grant select on public.product_inventory to authenticated;

-- Prevent an admin purchase edit/delete from making historical stock negative.
create or replace function public.validate_purchase_stock_integrity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  purchased_after integer;
  sold_count integer;
begin
  if tg_op = 'DELETE' then
    select coalesce(sum(quantity),0)::integer into purchased_after
    from public.purchases where product_id = old.product_id and id <> old.id;
    select coalesce(sum(quantity),0)::integer into sold_count
    from public.sales where product_id = old.product_id;
    if purchased_after < sold_count then
      raise exception 'Purchase deletion would make stock negative. Purchased after change: %, already sold: %', purchased_after, sold_count using errcode = 'P0001';
    end if;
    return old;
  end if;

  if new.product_id = old.product_id then
    select (coalesce(sum(quantity),0) + new.quantity)::integer into purchased_after
    from public.purchases where product_id = old.product_id and id <> old.id;
    select coalesce(sum(quantity),0)::integer into sold_count
    from public.sales where product_id = old.product_id;
    if purchased_after < sold_count then
      raise exception 'Purchase update would make stock negative. Purchased after change: %, already sold: %', purchased_after, sold_count using errcode = 'P0001';
    end if;
  else
    select coalesce(sum(quantity),0)::integer into purchased_after
    from public.purchases where product_id = old.product_id and id <> old.id;
    select coalesce(sum(quantity),0)::integer into sold_count
    from public.sales where product_id = old.product_id;
    if purchased_after < sold_count then
      raise exception 'Moving this purchase would make the original product stock negative' using errcode = 'P0001';
    end if;

    select (coalesce(sum(quantity),0) + new.quantity)::integer into purchased_after
    from public.purchases where product_id = new.product_id;
    select coalesce(sum(quantity),0)::integer into sold_count
    from public.sales where product_id = new.product_id;
    if purchased_after < sold_count then
      raise exception 'Purchase move would leave the destination product with invalid stock history' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists purchases_validate_stock_integrity on public.purchases;
create trigger purchases_validate_stock_integrity
before update of product_id, quantity or delete on public.purchases
for each row execute function public.validate_purchase_stock_integrity();

-- Explicit API privileges. RLS below still decides which rows/actions are permitted.
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.purchases to authenticated;
grant select, insert, update, delete on public.sales to authenticated;

-- ---------- RLS helpers ----------
create or replace function app_private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on public.profiles, public.products, public.purchases, public.sales from anon;
revoke all on public.product_inventory from anon;

revoke all on function app_private.is_admin() from public;
grant execute on function app_private.is_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.purchases enable row level security;
alter table public.sales enable row level security;

-- Profiles: users can read own profile; admins can read/manage all.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select app_private.is_admin()));

drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles for update to authenticated
using ((select app_private.is_admin())) with check ((select app_private.is_admin()));

-- Products: authenticated users can read; staff may insert new products to support first-purchase auto-create; only admin may update/delete.
drop policy if exists products_select on public.products;
create policy products_select on public.products for select to authenticated using (true);

drop policy if exists products_insert on public.products;
create policy products_insert on public.products for insert to authenticated with check (true);

drop policy if exists products_admin_update on public.products;
create policy products_admin_update on public.products for update to authenticated
using ((select app_private.is_admin())) with check ((select app_private.is_admin()));

drop policy if exists products_admin_delete on public.products;
create policy products_admin_delete on public.products for delete to authenticated using ((select app_private.is_admin()));

-- Purchases: everyone signed in may read/insert, admin only update/delete.
drop policy if exists purchases_select on public.purchases;
create policy purchases_select on public.purchases for select to authenticated using (true);

drop policy if exists purchases_insert on public.purchases;
create policy purchases_insert on public.purchases for insert to authenticated
with check (created_by = (select auth.uid()));

drop policy if exists purchases_admin_update on public.purchases;
create policy purchases_admin_update on public.purchases for update to authenticated
using ((select app_private.is_admin())) with check ((select app_private.is_admin()));

drop policy if exists purchases_admin_delete on public.purchases;
create policy purchases_admin_delete on public.purchases for delete to authenticated using ((select app_private.is_admin()));

-- Sales: everyone signed in may read/insert, admin only update/delete.
drop policy if exists sales_select on public.sales;
create policy sales_select on public.sales for select to authenticated using (true);

drop policy if exists sales_insert on public.sales;
create policy sales_insert on public.sales for insert to authenticated
with check (created_by = (select auth.uid()));

drop policy if exists sales_admin_update on public.sales;
create policy sales_admin_update on public.sales for update to authenticated
using ((select app_private.is_admin())) with check ((select app_private.is_admin()));

drop policy if exists sales_admin_delete on public.sales;
create policy sales_admin_delete on public.sales for delete to authenticated using ((select app_private.is_admin()));

-- Realtime publication. Ignore duplicate-object errors if rerun.
do $$ begin
  alter publication supabase_realtime add table public.products;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.purchases;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.sales;
exception when duplicate_object then null; end $$;

-- FIRST ADMIN BOOTSTRAP
-- 1) Sign up once through the application.
-- 2) Replace the email below, then run this one statement separately:
-- update public.profiles set role = 'admin' where email = 'owner@example.com';
