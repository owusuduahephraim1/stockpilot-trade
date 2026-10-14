-- StockPilot v1.8 Staff correction ownership
-- Staff may correct records they created. Admin/Owner may correct all records.
-- Deletion remains Admin/Owner only.

alter table public.products
  add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table public.customers
  add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table public.products alter column created_by set default auth.uid();
alter table public.customers alter column created_by set default auth.uid();

create index if not exists products_created_by_idx on public.products(created_by);
create index if not exists customers_created_by_idx on public.customers(created_by);

-- Product creation remains available to authenticated operators, but ownership
-- must resolve to the signed-in user. Existing legacy rows with null ownership
-- remain editable by Admin/Owner only.
drop policy if exists products_insert on public.products;
create policy products_insert on public.products for insert to authenticated
with check (created_by = (select auth.uid()));

drop policy if exists products_admin_update on public.products;
drop policy if exists products_update on public.products;
create policy products_update on public.products for update to authenticated
using (
  (select app_private.is_admin())
  or created_by = (select auth.uid())
)
with check (
  (select app_private.is_admin())
  or created_by = (select auth.uid())
);

-- Staff may correct only purchase lines they created. Admin/Owner may correct all.
drop policy if exists purchases_admin_update on public.purchases;
drop policy if exists purchases_update on public.purchases;
create policy purchases_update on public.purchases for update to authenticated
using (
  (select app_private.is_admin())
  or created_by = (select auth.uid())
)
with check (
  (select app_private.is_admin())
  or created_by = (select auth.uid())
);

-- Staff may correct only sale lines they created. Stock-integrity validation
-- continues to run on every sale update.
drop policy if exists sales_admin_update on public.sales;
drop policy if exists sales_update on public.sales;
create policy sales_update on public.sales for update to authenticated
using (
  (select app_private.is_admin())
  or created_by = (select auth.uid())
)
with check (
  (select app_private.is_admin())
  or created_by = (select auth.uid())
);

-- Customers use the same ownership rule as products.
drop policy if exists customers_insert on public.customers;
create policy customers_insert on public.customers for insert to authenticated
with check (created_by = (select auth.uid()));

drop policy if exists customers_admin_update on public.customers;
drop policy if exists customers_update on public.customers;
create policy customers_update on public.customers for update to authenticated
using (
  (select app_private.is_admin())
  or created_by = (select auth.uid())
)
with check (
  (select app_private.is_admin())
  or created_by = (select auth.uid())
);
