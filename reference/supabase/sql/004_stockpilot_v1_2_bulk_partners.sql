-- StockPilot v1.2 Bulk Transactions, Suppliers and Customers
-- Additive and backward-compatible with v1.0/v1.1 transaction rows.

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text,
  phone text,
  email text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists suppliers_name_unique_idx on public.suppliers(lower(name));
create unique index if not exists customers_name_unique_idx on public.customers(lower(name));

alter table public.purchases
  add column if not exists supplier_id uuid references public.suppliers(id) on delete set null,
  add column if not exists purchase_batch_id uuid,
  add column if not exists purchase_number text;

alter table public.sales
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists sale_batch_id uuid,
  add column if not exists sale_number text,
  add column if not exists payment_method text;

update public.purchases
set purchase_batch_id = id,
    purchase_number = coalesce(purchase_number, 'PUR-' || to_char(purchase_date,'YYYYMMDD') || '-' || upper(substr(replace(id::text,'-',''),1,8)))
where purchase_batch_id is null or purchase_number is null;

update public.sales
set sale_batch_id = id,
    sale_number = coalesce(sale_number, 'SAL-' || to_char(sale_date,'YYYYMMDD') || '-' || upper(substr(replace(id::text,'-',''),1,8)))
where sale_batch_id is null or sale_number is null;

create or replace function public.set_purchase_identity()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.purchase_batch_id is null then new.purchase_batch_id := gen_random_uuid(); end if;
  if new.purchase_number is null or btrim(new.purchase_number)='' then
    new.purchase_number := 'PUR-' || to_char(new.purchase_date,'YYYYMMDD') || '-' || upper(substr(replace(new.purchase_batch_id::text,'-',''),1,8));
  end if;
  return new;
end;$$;

drop trigger if exists purchases_set_identity on public.purchases;
create trigger purchases_set_identity before insert or update of purchase_date,purchase_batch_id,purchase_number on public.purchases
for each row execute function public.set_purchase_identity();

create or replace function public.set_sale_identity()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.sale_batch_id is null then new.sale_batch_id := gen_random_uuid(); end if;
  if new.sale_number is null or btrim(new.sale_number)='' then
    new.sale_number := 'SAL-' || to_char(new.sale_date,'YYYYMMDD') || '-' || upper(substr(replace(new.sale_batch_id::text,'-',''),1,8));
  end if;
  return new;
end;$$;

drop trigger if exists sales_set_identity on public.sales;
create trigger sales_set_identity before insert or update of sale_date,sale_batch_id,sale_number on public.sales
for each row execute function public.set_sale_identity();

create index if not exists purchases_supplier_id_idx on public.purchases(supplier_id);
create index if not exists purchases_batch_id_idx on public.purchases(purchase_batch_id);
create index if not exists purchases_number_idx on public.purchases(purchase_number);
create index if not exists sales_customer_id_idx on public.sales(customer_id);
create index if not exists sales_batch_id_idx on public.sales(sale_batch_id);
create index if not exists sales_number_idx on public.sales(sale_number);
create unique index if not exists purchases_batch_product_unique_idx on public.purchases(purchase_batch_id,product_id) where purchase_batch_id is not null;
create unique index if not exists sales_batch_product_unique_idx on public.sales(sale_batch_id,product_id) where sale_batch_id is not null;

drop trigger if exists suppliers_set_updated_at on public.suppliers;
create trigger suppliers_set_updated_at before update on public.suppliers for each row execute function public.set_updated_at();
drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at before update on public.customers for each row execute function public.set_updated_at();

drop trigger if exists suppliers_activity_log on public.suppliers;
create trigger suppliers_activity_log after insert or update or delete on public.suppliers for each row execute function app_private.log_activity();
drop trigger if exists customers_activity_log on public.customers;
create trigger customers_activity_log after insert or update or delete on public.customers for each row execute function app_private.log_activity();

grant select,insert,update,delete on public.suppliers to authenticated;
grant select,insert,update,delete on public.customers to authenticated;
revoke all on public.suppliers,public.customers from anon;
alter table public.suppliers enable row level security;
alter table public.customers enable row level security;

drop policy if exists suppliers_select on public.suppliers;
create policy suppliers_select on public.suppliers for select to authenticated using(true);
drop policy if exists suppliers_insert on public.suppliers;
create policy suppliers_insert on public.suppliers for insert to authenticated with check(true);
drop policy if exists suppliers_admin_update on public.suppliers;
create policy suppliers_admin_update on public.suppliers for update to authenticated using((select app_private.is_admin())) with check((select app_private.is_admin()));
drop policy if exists suppliers_admin_delete on public.suppliers;
create policy suppliers_admin_delete on public.suppliers for delete to authenticated using((select app_private.is_admin()));

drop policy if exists customers_select on public.customers;
create policy customers_select on public.customers for select to authenticated using(true);
drop policy if exists customers_insert on public.customers;
create policy customers_insert on public.customers for insert to authenticated with check(true);
drop policy if exists customers_admin_update on public.customers;
create policy customers_admin_update on public.customers for update to authenticated using((select app_private.is_admin())) with check((select app_private.is_admin()));
drop policy if exists customers_admin_delete on public.customers;
create policy customers_admin_delete on public.customers for delete to authenticated using((select app_private.is_admin()));

do $$ begin alter publication supabase_realtime add table public.suppliers; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.customers; exception when duplicate_object then null; end $$;
