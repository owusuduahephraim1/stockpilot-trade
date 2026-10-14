-- StockPilot v1.1 performance follow-up
create index if not exists exchange_rates_updated_by_idx on public.exchange_rates(updated_by);
