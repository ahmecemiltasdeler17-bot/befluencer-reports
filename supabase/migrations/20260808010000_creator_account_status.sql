-- Creator account lifecycle for permanently unavailable TikTok profiles.
-- Soft status only — never auto hard-deletes creators.

alter table public.creators
  add column if not exists account_status text not null default 'active',
  add column if not exists unavailable_reason text,
  add column if not exists unavailable_at timestamptz;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'creators_account_status_check'
  ) then
    alter table public.creators
      add constraint creators_account_status_check
      check (account_status in ('active', 'unavailable'));
  end if;
end $$;

comment on column public.creators.account_status is
  'active = eligible for automatic TikTok sync; unavailable = permanently missing/banned/private for sync purposes.';

comment on column public.creators.unavailable_reason is
  'Normalized reason: not_found | banned | deleted | private | suspended.';

comment on column public.creators.unavailable_at is
  'When the creator was marked unavailable after definitive provider evidence.';

create index if not exists creators_account_status_idx
  on public.creators (account_status);
