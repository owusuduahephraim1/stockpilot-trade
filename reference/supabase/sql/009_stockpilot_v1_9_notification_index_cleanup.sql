-- StockPilot v1.9 notification read cleanup
-- The primary key already supports user/key lookups. No timestamp index is required.
drop index if exists public.user_alert_reads_seen_at_idx;
