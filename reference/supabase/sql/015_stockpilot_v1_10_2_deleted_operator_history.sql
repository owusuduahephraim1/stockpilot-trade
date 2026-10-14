-- StockPilot v1.10.2
-- Preserve historical operator attribution when an authentication account is permanently removed.
--
-- The profiles row becomes a historical operator identity after auth.users is deleted.
-- Purchases, sales and activity logs continue to reference that profile, so business history
-- remains accurate instead of being reassigned to the Owner/Admin.

alter table public.profiles
  add column if not exists account_deleted_at timestamptz;

-- The original FK used ON DELETE CASCADE. That is inappropriate for a permanent Staff-login
-- deletion because purchases/sales deliberately RESTRICT profile deletion to protect history.
-- Authentication and historical operator identity are therefore decoupled intentionally.
alter table public.profiles
  drop constraint if exists profiles_id_fkey;

comment on column public.profiles.account_deleted_at is
  'Timestamp when the authentication account was permanently removed. The profile remains only for historical operator attribution.';

create index if not exists profiles_account_deleted_at_idx
  on public.profiles(account_deleted_at)
  where account_deleted_at is not null;
