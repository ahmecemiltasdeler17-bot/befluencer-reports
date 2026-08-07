-- BeFluencer Reports — scheduled automatic TikTok sync
--
-- Phase 12 adds a parent audit table for cron / manual full-sync runs and a
-- PostgreSQL advisory-lock pair so two invocations cannot process together.
-- Per-video / per-creator / per-sound work continues to write sync_jobs rows.

-- ---------------------------------------------------------------------------
-- scheduled_sync_runs
-- ---------------------------------------------------------------------------

create table if not exists public.scheduled_sync_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null,
  status text not null,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  triggered_by text not null default 'cron',
  total_campaigns integer not null default 0,
  successful_campaigns integer not null default 0,
  failed_campaigns integer not null default 0,
  skipped_campaigns integer not null default 0,
  video_success integer not null default 0,
  video_failed integer not null default 0,
  creator_success integer not null default 0,
  creator_failed integer not null default 0,
  sound_success integer not null default 0,
  sound_failed integer not null default 0,
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint scheduled_sync_runs_run_type_check
    check (run_type in ('full_tiktok_sync')),
  constraint scheduled_sync_runs_status_check
    check (status in ('running', 'success', 'partial', 'failed', 'skipped')),
  constraint scheduled_sync_runs_triggered_by_check
    check (triggered_by in ('cron', 'manual')),
  constraint scheduled_sync_runs_counts_nonnegative_check
    check (
      total_campaigns >= 0
      and successful_campaigns >= 0
      and failed_campaigns >= 0
      and skipped_campaigns >= 0
      and video_success >= 0
      and video_failed >= 0
      and creator_success >= 0
      and creator_failed >= 0
      and sound_success >= 0
      and sound_failed >= 0
    )
);

comment on table public.scheduled_sync_runs is
  'Parent audit log for scheduled or manual full TikTok sync runs. Child work remains in sync_jobs.';

create index if not exists scheduled_sync_runs_status_started_at_idx
  on public.scheduled_sync_runs (status, started_at desc);

create index if not exists scheduled_sync_runs_started_at_idx
  on public.scheduled_sync_runs (started_at desc);

alter table public.scheduled_sync_runs enable row level security;

revoke all on public.scheduled_sync_runs from anon;
revoke all on public.scheduled_sync_runs from authenticated;

-- Browser / authenticated clients may only read history. Writes happen through the
-- server-only service-role client used by cron and the internal manual route.
grant select on public.scheduled_sync_runs to authenticated;

drop policy if exists scheduled_sync_runs_authenticated_select
  on public.scheduled_sync_runs;

create policy scheduled_sync_runs_authenticated_select
  on public.scheduled_sync_runs
  for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Advisory lock helpers (security definer)
-- ---------------------------------------------------------------------------

-- Fixed lock key for the global TikTok scheduled sync orchestrator.
-- hashtext is stable within a database for the same string.

create or replace function public.try_acquire_scheduled_sync_lock()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return pg_try_advisory_lock(
    ('x' || substr(md5('befluencer_scheduled_tiktok_sync'), 1, 16))::bit(64)::bigint
  );
end;
$$;

create or replace function public.release_scheduled_sync_lock()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return pg_advisory_unlock(
    ('x' || substr(md5('befluencer_scheduled_tiktok_sync'), 1, 16))::bit(64)::bigint
  );
end;
$$;

revoke all on function public.try_acquire_scheduled_sync_lock() from public;
revoke all on function public.release_scheduled_sync_lock() from public;

-- Callable by the service-role client (cron / internal orchestrator).
grant execute on function public.try_acquire_scheduled_sync_lock() to service_role;
grant execute on function public.release_scheduled_sync_lock() to service_role;

comment on function public.try_acquire_scheduled_sync_lock() is
  'Non-blocking advisory lock for the global scheduled TikTok sync. Returns false when another run holds the lock.';

comment on function public.release_scheduled_sync_lock() is
  'Releases the global scheduled TikTok sync advisory lock. Safe to call when the lock was not held by this session.';
