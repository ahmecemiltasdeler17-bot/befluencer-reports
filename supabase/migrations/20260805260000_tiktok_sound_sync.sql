-- BeFluencer Reports — TikTok sound usage sync
--
-- Phase 11 adds manual one-click sync of a campaign's TikTok sound usage count.
--
-- Design notes:
-- - `campaigns.sound_url` already stores the TikTok music URL; it is reused as
--   the canonical sound URL (no duplicate `tiktok_sound_url` column).
-- - Sound identity metadata (`tiktok_sound_id`, title, author) and sync state
--   live on `campaigns` and are overwritten on a successful sync.
-- - `sound_metric_snapshots` stays append-only history. A new `source` column
--   distinguishes manual entry from Apify sync without breaking existing rows.
-- - UPDATE privilege on sound snapshots is revoked to match creator/video
--   snapshot append-only semantics (correct a bad row by deleting it).
-- - `sync_jobs.job_type` has no check constraint; `tiktok_sound_sync` uses the
--   existing `campaign_id` target column.

-- ---------------------------------------------------------------------------
-- campaigns — sound identity + sync state
-- ---------------------------------------------------------------------------

alter table public.campaigns
  add column if not exists tiktok_sound_id text;

alter table public.campaigns
  add column if not exists tiktok_sound_title text;

alter table public.campaigns
  add column if not exists tiktok_sound_author text;

alter table public.campaigns
  add column if not exists sound_last_synced_at timestamptz;

alter table public.campaigns
  add column if not exists sound_sync_status text not null default 'pending';

alter table public.campaigns
  add column if not exists sound_sync_error text;

alter table public.campaigns
  drop constraint if exists campaigns_sound_sync_status_check;

alter table public.campaigns
  add constraint campaigns_sound_sync_status_check
  check (sound_sync_status in ('pending', 'success', 'failed'));

comment on column public.campaigns.sound_url is
  'Canonical TikTok music/sound URL. Reused as the sync input; normalized on a successful sync.';

comment on column public.campaigns.tiktok_sound_id is
  'Numeric TikTok music id parsed from the URL or returned by the provider.';

comment on column public.campaigns.tiktok_sound_title is
  'Sound title from the provider when available. Never invent a title.';

comment on column public.campaigns.tiktok_sound_author is
  'Sound author / original creator name from the provider when available.';

comment on column public.campaigns.sound_last_synced_at is
  'Timestamp of the most recent successful sound usage sync.';

comment on column public.campaigns.sound_sync_status is
  'Result of the most recent sound sync attempt for this campaign.';

comment on column public.campaigns.sound_sync_error is
  'Sanitized Turkish error from the last failed sound sync. Cleared on success.';

create index if not exists campaigns_sound_last_synced_at_idx
  on public.campaigns (sound_last_synced_at desc nulls last);

create index if not exists campaigns_sound_sync_status_idx
  on public.campaigns (sound_sync_status);

-- ---------------------------------------------------------------------------
-- sound_metric_snapshots — source + created_at + append-only privileges
-- ---------------------------------------------------------------------------

alter table public.sound_metric_snapshots
  add column if not exists created_at timestamptz not null default timezone('utc', now());

alter table public.sound_metric_snapshots
  add column if not exists source text not null default 'manual';

alter table public.sound_metric_snapshots
  drop constraint if exists sound_metric_snapshots_source_check;

alter table public.sound_metric_snapshots
  add constraint sound_metric_snapshots_source_check
  check (source in ('manual', 'apify'));

comment on column public.sound_metric_snapshots.source is
  'Origin of the row: manual form entry or Apify sound sync. Both feed report charts.';

comment on column public.sound_metric_snapshots.created_at is
  'Row insert time. Distinct from captured_at, which is the metric timestamp.';

create index if not exists sound_metric_snapshots_captured_at_idx
  on public.sound_metric_snapshots (captured_at desc);

-- Append-only: revoke UPDATE so historical usage cannot be rewritten.
revoke update on public.sound_metric_snapshots from authenticated;

drop policy if exists sound_metric_snapshots_authenticated_update
  on public.sound_metric_snapshots;

-- ---------------------------------------------------------------------------
-- sync_jobs — document sound job type (campaign_id already exists)
-- ---------------------------------------------------------------------------

comment on column public.sync_jobs.job_type is
  'Sync kind: tiktok_video_sync, tiktok_creator_sync, or tiktok_sound_sync.';

comment on column public.sync_jobs.campaign_id is
  'Campaign target for tiktok_sound_sync and tiktok_video_sync jobs.';
