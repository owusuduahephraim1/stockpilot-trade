-- StockPilot v1.10.1
-- Official Bank of Ghana daily interbank FX source metadata.

alter table public.exchange_rates
  add column if not exists rate_source text not null default 'manual',
  add column if not exists source_date date;

alter table public.exchange_rates
  drop constraint if exists exchange_rates_rate_source_check;

alter table public.exchange_rates
  add constraint exchange_rates_rate_source_check
  check (rate_source in ('manual', 'bank_of_ghana'));

comment on column public.exchange_rates.rate_source is
  'manual for administrator fallback/override, bank_of_ghana for official daily interbank mid-rate sync.';

comment on column public.exchange_rates.source_date is
  'Publication/effective date supplied by the official FX source when available.';
