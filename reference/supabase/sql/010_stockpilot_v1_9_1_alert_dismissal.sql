-- StockPilot v1.9.1
-- Reversible, per-user dismissal for operational alerts.

alter table public.user_alert_reads
  add column if not exists dismissed boolean not null default false,
  add column if not exists dismissed_at timestamptz;

comment on column public.user_alert_reads.dismissed is
  'When true, the current fingerprint for this alert is hidden from this user until reset or the condition fingerprint changes.';

comment on column public.user_alert_reads.dismissed_at is
  'Timestamp when the user cleared the current alert fingerprint from their visible alert register.';
