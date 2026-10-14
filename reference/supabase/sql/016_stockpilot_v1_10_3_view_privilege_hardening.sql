-- StockPilot v1.10.3 final view privilege hardening
-- Keep authenticated operational reporting available while removing unnecessary
-- unauthenticated privileges inherited by the stock_movements view.

revoke all on table public.stock_movements from anon;
grant select on table public.stock_movements to authenticated;

-- The reporting view must continue to execute with caller privileges so the
-- underlying purchases and sales RLS policies remain authoritative.
alter view public.stock_movements set (security_invoker = true);
