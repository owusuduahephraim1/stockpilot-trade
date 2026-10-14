-- StockPilot v1.10.3 atomic new-product purchase transaction
-- Creating a catalogue product from the Purchases workflow and recording its
-- opening purchase must commit together. The function is SECURITY INVOKER so
-- normal authenticated RLS and workspace membership policies remain in force.

create or replace function public.record_purchase_with_new_product(
  p_product jsonb,
  p_lines jsonb,
  p_meta jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_product_id uuid;
  v_batch_id uuid := gen_random_uuid();
  v_currency text := nullif(btrim(p_meta->>'currency'), '');
  v_fx numeric := (p_meta->>'fx_rate_to_ghs')::numeric;
  v_purchase_date date := (p_meta->>'purchase_date')::date;
  v_supplier_id uuid := nullif(p_meta->>'supplier_id', '')::uuid;
  v_manufacturer text := nullif(btrim(p_meta->>'manufacturer'), '');
  v_notes text := nullif(btrim(p_meta->>'notes'), '');
  v_invoice_url text := nullif(p_meta->>'invoice_url', '');
  v_line record;
begin
  if v_user is null or not app_private.is_workspace_user() then
    raise exception 'Active StockPilot workspace membership is required';
  end if;
  if v_currency not in ('GHS','GBP','USD') or v_fx is null or v_fx <= 0 then
    raise exception 'A valid transaction currency and exchange rate are required';
  end if;
  if v_purchase_date is null then
    raise exception 'Purchase date is required';
  end if;
  if jsonb_typeof(coalesce(p_lines, '[]'::jsonb)) <> 'array' then
    raise exception 'Purchase lines must be an array';
  end if;

  insert into public.products (
    sku, barcode, name, category, description, manufacturer, currency,
    low_stock_threshold, current_cost_price, current_selling_price, created_by
  ) values (
    upper(btrim(p_product->>'sku')),
    nullif(btrim(p_product->>'barcode'), ''),
    btrim(p_product->>'name'),
    nullif(btrim(p_product->>'category'), ''),
    nullif(btrim(p_product->>'description'), ''),
    v_manufacturer,
    v_currency,
    (p_product->>'low_stock_threshold')::integer,
    (p_product->>'unit_cost')::numeric,
    (p_product->>'selling_price')::numeric,
    v_user
  )
  returning id into v_product_id;

  insert into public.purchases (
    product_id, quantity, unit_cost, currency, fx_rate_to_ghs, purchase_date,
    supplier_id, manufacturer, notes, invoice_url, created_by, purchase_batch_id
  ) values (
    v_product_id,
    (p_product->>'quantity')::integer,
    (p_product->>'unit_cost')::numeric,
    v_currency,
    v_fx,
    v_purchase_date,
    v_supplier_id,
    v_manufacturer,
    v_notes,
    v_invoice_url,
    v_user,
    v_batch_id
  );

  for v_line in
    select *
    from jsonb_to_recordset(coalesce(p_lines, '[]'::jsonb))
      as x(product_id uuid, quantity integer, unit_cost numeric)
  loop
    insert into public.purchases (
      product_id, quantity, unit_cost, currency, fx_rate_to_ghs, purchase_date,
      supplier_id, manufacturer, notes, invoice_url, created_by, purchase_batch_id
    ) values (
      v_line.product_id,
      v_line.quantity,
      v_line.unit_cost,
      v_currency,
      v_fx,
      v_purchase_date,
      v_supplier_id,
      v_manufacturer,
      v_notes,
      v_invoice_url,
      v_user,
      v_batch_id
    );
  end loop;

  return jsonb_build_object('product_id', v_product_id, 'purchase_batch_id', v_batch_id);
end;
$$;

revoke all on function public.record_purchase_with_new_product(jsonb,jsonb,jsonb) from public, anon;
grant execute on function public.record_purchase_with_new_product(jsonb,jsonb,jsonb) to authenticated;
