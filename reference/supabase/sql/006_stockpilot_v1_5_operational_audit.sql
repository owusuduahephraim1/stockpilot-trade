-- StockPilot v1.5 Operational Audit Trail
-- Enriches future audit events with immutable event-time context snapshots.
-- Existing activity_logs remain untouched and continue to be readable by the upgraded UI.

create or replace function app_private.log_activity()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  rid uuid;
  payload jsonb;
  row_data jsonb;
  actor_id uuid := auth.uid();
  actor_snapshot jsonb;
  product_snapshot jsonb;
  supplier_snapshot jsonb;
  customer_snapshot jsonb;
  context_snapshot jsonb;
begin
  if tg_op='DELETE' then
    rid := old.id;
    row_data := to_jsonb(old);
    payload := jsonb_build_object('before', row_data);
  elsif tg_op='INSERT' then
    rid := new.id;
    row_data := to_jsonb(new);
    payload := jsonb_build_object('after', row_data);
  else
    rid := new.id;
    row_data := to_jsonb(new);
    payload := jsonb_build_object('before', to_jsonb(old), 'after', row_data);
  end if;

  if actor_id is not null then
    select jsonb_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'email', p.email,
      'role', p.role
    )
    into actor_snapshot
    from public.profiles p
    where p.id = actor_id;
  end if;

  if row_data ? 'product_id' and nullif(row_data->>'product_id','') is not null then
    select jsonb_build_object(
      'id', p.id,
      'sku', p.sku,
      'name', p.name,
      'barcode', p.barcode,
      'category', p.category,
      'manufacturer', p.manufacturer
    )
    into product_snapshot
    from public.products p
    where p.id = (row_data->>'product_id')::uuid;
  end if;

  if tg_table_name='purchases' and row_data ? 'supplier_id' and nullif(row_data->>'supplier_id','') is not null then
    select jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'contact_person', s.contact_person,
      'phone', s.phone,
      'email', s.email
    )
    into supplier_snapshot
    from public.suppliers s
    where s.id = (row_data->>'supplier_id')::uuid;
  end if;

  if tg_table_name='sales' and row_data ? 'customer_id' and nullif(row_data->>'customer_id','') is not null then
    select jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'phone', c.phone,
      'email', c.email
    )
    into customer_snapshot
    from public.customers c
    where c.id = (row_data->>'customer_id')::uuid;
  end if;

  context_snapshot := jsonb_strip_nulls(jsonb_build_object(
    'actor', actor_snapshot,
    'product', product_snapshot,
    'supplier', supplier_snapshot,
    'customer', customer_snapshot
  ));

  payload := payload || jsonb_build_object('context', context_snapshot);

  insert into public.activity_logs(user_id, action, entity_type, entity_id, details)
  values(actor_id, lower(tg_op), tg_table_name, rid, payload);

  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function app_private.log_activity() from public;

-- Reinforce append-only application access. Audit rows are written only by the
-- security-definer trigger above and are read-only to authenticated users.
revoke insert, update, delete, truncate on public.activity_logs from authenticated;
revoke all on public.activity_logs from anon;
grant select on public.activity_logs to authenticated;

comment on table public.activity_logs is
  'Append-only StockPilot operational audit history. Application users may read but cannot modify audit rows.';
