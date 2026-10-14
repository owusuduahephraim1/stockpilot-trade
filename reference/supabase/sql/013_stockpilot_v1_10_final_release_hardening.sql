-- StockPilot v1.10.0 final release database hardening
-- Safe additive/replace-in-place migration for the existing production database.

-- Complete provenance on rows that predate created_by ownership tracking.
do $$
declare
  owner_id uuid;
begin
  select id into owner_id
  from public.profiles
  where role = 'admin'
  order by created_at asc
  limit 1;

  if owner_id is not null then
    update public.products set created_by = owner_id where created_by is null;
    update public.customers set created_by = owner_id where created_by is null;
  end if;
end $$;

-- Defend against case/whitespace duplicates even when the browser UI is bypassed.
create unique index if not exists products_sku_normalized_unique_idx
  on public.products (lower(btrim(sku)));
create unique index if not exists products_barcode_normalized_unique_idx
  on public.products (lower(btrim(barcode)))
  where barcode is not null and btrim(barcode) <> '';

-- Preserve both original transaction-currency and GHS accounting semantics.
create or replace function public.calculate_sale_total()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  avg_cost_ghs numeric;
begin
  if new.fx_rate_to_ghs is null or new.fx_rate_to_ghs <= 0 then
    raise exception 'Exchange rate must be greater than zero' using errcode = '22023';
  end if;

  new.total_amount := round(new.quantity::numeric * new.unit_price, 2);
  new.total_amount_ghs := round(new.total_amount * new.fx_rate_to_ghs, 2);

  select case
    when coalesce(sum(quantity), 0) > 0 then sum(total_cost_ghs) / sum(quantity)
    else 0
  end
  into avg_cost_ghs
  from public.purchases
  where product_id = new.product_id;

  new.unit_cost_basis_ghs := round(coalesce(avg_cost_ghs, 0), 2);
  new.profit_ghs := round(new.total_amount_ghs - (new.quantity::numeric * new.unit_cost_basis_ghs), 2);
  new.unit_cost_basis := round(new.unit_cost_basis_ghs / new.fx_rate_to_ghs, 2);
  new.profit := round(new.total_amount - (new.quantity::numeric * new.unit_cost_basis), 2);
  return new;
end;
$$;

-- Serialize sales for the same product so two simultaneous transactions cannot
-- both consume the same last units.
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
  perform 1 from public.products where id = new.product_id for update;

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

-- Serialize purchase reductions/moves/deletions with sale validation for the
-- affected products so historical stock can never become negative under load.
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
    perform 1 from public.products where id = old.product_id for update;
    select coalesce(sum(quantity),0)::integer into purchased_after
    from public.purchases where product_id = old.product_id and id <> old.id;
    select coalesce(sum(quantity),0)::integer into sold_count
    from public.sales where product_id = old.product_id;
    if purchased_after < sold_count then
      raise exception 'Purchase deletion would make stock negative. Purchased after change: %, already sold: %', purchased_after, sold_count using errcode = 'P0001';
    end if;
    return old;
  end if;

  perform 1
  from public.products
  where id in (old.product_id, new.product_id)
  order by id
  for update;

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
