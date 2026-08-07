-- BeFluencer Reports — creator profile and follower snapshots
--
-- Phase 10 adds manual TikTok creator profile sync.
--
-- Design notes:
-- - `creators` keeps the *current* profile state (follower_count, avatar_url,
--   display_name, profile_url). It is overwritten on every successful sync.
-- - `creator_metric_snapshots` keeps the *history* of follower counts so growth
--   can be measured over time. It is append-only: no UPDATE privilege and no
--   UPDATE policy are granted, exactly like the video and sound snapshot tables.
-- - Campaign-specific values (fee, agreed_content_count, notes) live on
--   `campaign_creators` and are never touched by a provider sync.

-- ---------------------------------------------------------------------------
-- creators — sync state
-- ---------------------------------------------------------------------------

alter table public.creators
  add column if not exists last_synced_at timestamptz;

alter table public.creators
  add column if not exists sync_status text not null default 'pending';

-- Mirrors videos.sync_status so both sync surfaces read the same vocabulary.
alter table public.creators
  drop constraint if exists creators_sync_status_check;

alter table public.creators
  add constraint creators_sync_status_check
  check (sync_status in ('pending', 'success', 'failed'));

comment on column public.creators.last_synced_at is
  'Timestamp of the most recent successful provider profile sync.';

comment on column public.creators.sync_status is
  'Result of the most recent profile sync attempt for this creator.';

comment on column public.creators.follower_count is
  'Current follower count. Overwritten by a successful sync; history lives in creator_metric_snapshots.';

comment on column public.creators.profile_url is
  'Canonical social profile URL. Reports fall back to a deterministic URL built from platform + username when empty.';

comment on column public.creators.avatar_url is
  'Provider avatar URL. Signed CDN URLs may expire; the UI falls back to initials.';

create index if not exists creators_last_synced_at_idx
  on public.creators (last_synced_at desc nulls last);

create index if not exists creators_sync_status_idx
  on public.creators (sync_status);

-- ---------------------------------------------------------------------------
-- creator_metric_snapshots
-- ---------------------------------------------------------------------------

create table if not exists public.creator_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  captured_at timestamptz not null default timezone('utc', now()),
  follower_count bigint not null check (follower_count >= 0),
  following_count bigint check (following_count is null or following_count >= 0),
  total_likes bigint check (total_likes is null or total_likes >= 0),
  video_count integer check (video_count is null or video_count >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  unique (creator_id, captured_at)
);

comment on table public.creator_metric_snapshots is
  'Append-only time series of creator profile statistics. Never overwrite historical values; the earliest row defines the growth baseline.';

comment on column public.creator_metric_snapshots.captured_at is
  'Server-side capture time. Unique per creator: a colliding sync retries with +1 second.';

comment on column public.creator_metric_snapshots.follower_count is
  'Required. A sync that cannot read a follower count fails instead of writing a guess.';

comment on column public.creator_metric_snapshots.following_count is
  'Optional — null when the provider did not expose it.';

comment on column public.creator_metric_snapshots.total_likes is
  'Optional lifetime like count across the creator profile.';

comment on column public.creator_metric_snapshots.video_count is
  'Optional public video count on the profile, unrelated to campaign video count.';

create index if not exists creator_metric_snapshots_creator_id_captured_at_idx
  on public.creator_metric_snapshots (creator_id, captured_at desc);

create index if not exists creator_metric_snapshots_captured_at_idx
  on public.creator_metric_snapshots (captured_at desc);

-- ---------------------------------------------------------------------------
-- sync_jobs — creator target
-- ---------------------------------------------------------------------------

alter table public.sync_jobs
  add column if not exists creator_id uuid references public.creators (id) on delete set null;

-- Target semantics: `job_type` decides which target column is meaningful.
--   tiktok_video_sync   -> campaign_id + video_id
--   tiktok_creator_sync -> creator_id (campaign_id stays null: a creator is
--                          global and may be assigned to many campaigns)
-- No column is required, so a target row deleted later leaves the audit entry
-- intact rather than cascading the history away. `job_type` has no check
-- constraint, so new job types need no schema change.
comment on column public.sync_jobs.creator_id is
  'Creator target for tiktok_creator_sync jobs. Null for video sync jobs.';

comment on column public.sync_jobs.video_id is
  'Video target for tiktok_video_sync jobs. Null for creator sync jobs.';

comment on column public.sync_jobs.job_type is
  'Sync kind: tiktok_video_sync or tiktok_creator_sync. Determines which target column is populated.';

create index if not exists sync_jobs_creator_id_idx
  on public.sync_jobs (creator_id);

create index if not exists sync_jobs_creator_id_created_at_idx
  on public.sync_jobs (creator_id, created_at desc);

create index if not exists sync_jobs_job_type_idx
  on public.sync_jobs (job_type);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.creator_metric_snapshots enable row level security;

revoke all on public.creator_metric_snapshots from anon;

-- Append-only: UPDATE is deliberately withheld at the privilege level so a
-- historical follower count cannot be rewritten even by an authenticated user.
grant select, insert, delete on public.creator_metric_snapshots to authenticated;

drop policy if exists creator_metric_snapshots_authenticated_select on public.creator_metric_snapshots;
drop policy if exists creator_metric_snapshots_authenticated_insert on public.creator_metric_snapshots;
drop policy if exists creator_metric_snapshots_authenticated_delete on public.creator_metric_snapshots;

create policy creator_metric_snapshots_authenticated_select
  on public.creator_metric_snapshots
  for select
  to authenticated
  using (true);

create policy creator_metric_snapshots_authenticated_insert
  on public.creator_metric_snapshots
  for insert
  to authenticated
  with check (true);

create policy creator_metric_snapshots_authenticated_delete
  on public.creator_metric_snapshots
  for delete
  to authenticated
  using (true);

-- No UPDATE policy exists by design. Correcting a bad row means deleting it.
