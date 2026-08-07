-- BeFluencer Reports — initial schema
-- Internal TikTok music campaign analytics platform
--
-- Security model:
-- - RLS enabled on every table
-- - No anonymous or public policies in this migration
-- - Access will be granted explicitly when internal auth is introduced

-- ---------------------------------------------------------------------------
-- Extensions & shared utilities
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto;

comment on extension pgcrypto is 'Provides gen_random_uuid() for primary keys.';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Shared trigger function to keep updated_at in sync on row changes.';

-- ---------------------------------------------------------------------------
-- campaigns
-- ---------------------------------------------------------------------------

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  artist_name text not null,
  track_name text not null,
  client_name text,
  sound_url text,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'completed', 'archived')),
  start_date date,
  end_date date,
  report_number text unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.campaigns is
  'Top-level music promotion campaign. One campaign maps to one client report.';

comment on column public.campaigns.report_number is
  'Human-readable report identifier shown in PDF exports (e.g. RPT-2026-0047).';

create index campaigns_status_idx on public.campaigns (status);
create index campaigns_start_date_idx on public.campaigns (start_date desc);

create trigger campaigns_set_updated_at
before update on public.campaigns
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- creators
-- ---------------------------------------------------------------------------

create table public.creators (
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'tiktok',
  username text not null,
  display_name text,
  profile_url text,
  avatar_url text,
  follower_count bigint not null default 0,
  category text not null default 'micro'
    check (category in ('macro', 'micro', 'template')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (platform, username)
);

comment on table public.creators is
  'Global creator directory reused across campaigns.';

create index creators_category_idx on public.creators (category);
create index creators_follower_count_idx on public.creators (follower_count desc);

create trigger creators_set_updated_at
before update on public.creators
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- campaign_creators
-- ---------------------------------------------------------------------------

create table public.campaign_creators (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  creator_id uuid not null references public.creators (id) on delete cascade,
  agreed_content_count integer not null default 1 check (agreed_content_count >= 0),
  fee numeric,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (campaign_id, creator_id)
);

comment on table public.campaign_creators is
  'Join table linking creators to a campaign with deliverable and fee metadata.';

create index campaign_creators_campaign_id_idx on public.campaign_creators (campaign_id);
create index campaign_creators_creator_id_idx on public.campaign_creators (creator_id);

-- ---------------------------------------------------------------------------
-- videos
-- ---------------------------------------------------------------------------

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  creator_id uuid not null references public.creators (id) on delete restrict,
  platform text not null default 'tiktok',
  video_url text not null unique,
  platform_video_id text,
  thumbnail_url text,
  caption text,
  published_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'published', 'unavailable')),
  last_synced_at timestamptz,
  sync_status text not null default 'pending'
    check (sync_status in ('pending', 'success', 'failed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.videos is
  'Tracked social posts for a campaign. Metrics are stored separately as snapshots.';

comment on column public.videos.sync_status is
  'Result of the most recent metric sync attempt for this video.';

create index videos_campaign_id_idx on public.videos (campaign_id);
create index videos_creator_id_idx on public.videos (creator_id);
create index videos_status_idx on public.videos (status);
create index videos_last_synced_at_idx on public.videos (last_synced_at desc nulls last);
create index videos_sync_status_idx on public.videos (sync_status);

create trigger videos_set_updated_at
before update on public.videos
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- video_metric_snapshots
-- ---------------------------------------------------------------------------

create table public.video_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  captured_at timestamptz not null default timezone('utc', now()),
  views bigint not null default 0 check (views >= 0),
  likes bigint not null default 0 check (likes >= 0),
  comments bigint not null default 0 check (comments >= 0),
  shares bigint not null default 0 check (shares >= 0),
  saves bigint not null default 0 check (saves >= 0)
);

comment on table public.video_metric_snapshots is
  'Append-only time series of video metrics. Never overwrite historical values.';

create index video_metric_snapshots_video_id_captured_at_idx
  on public.video_metric_snapshots (video_id, captured_at desc);

-- ---------------------------------------------------------------------------
-- sound_metric_snapshots
-- ---------------------------------------------------------------------------

create table public.sound_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  captured_at timestamptz not null default timezone('utc', now()),
  usage_count bigint not null default 0 check (usage_count >= 0)
);

comment on table public.sound_metric_snapshots is
  'Append-only TikTok sound usage counts for campaign sound growth charts.';

create index sound_metric_snapshots_campaign_id_captured_at_idx
  on public.sound_metric_snapshots (campaign_id, captured_at desc);

-- ---------------------------------------------------------------------------
-- reports
-- ---------------------------------------------------------------------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  public_slug text unique,
  report_number text,
  generated_at timestamptz,
  last_updated_at timestamptz,
  is_public boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.reports is
  'Generated report metadata. PDF assets and share links will reference this table.';

comment on column public.reports.is_public is
  'When true, a future read-only share route may expose the report via public_slug.';

create index reports_campaign_id_idx on public.reports (campaign_id);
create index reports_is_public_idx on public.reports (is_public) where is_public = true;

-- ---------------------------------------------------------------------------
-- sync_jobs
-- ---------------------------------------------------------------------------

create table public.sync_jobs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns (id) on delete set null,
  video_id uuid references public.videos (id) on delete set null,
  job_type text not null,
  status text not null default 'running'
    check (status in ('running', 'success', 'failed')),
  error_message text,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.sync_jobs is
  'Audit log for scheduled and manual TikTok metric sync runs.';

create index sync_jobs_campaign_id_idx on public.sync_jobs (campaign_id);
create index sync_jobs_video_id_idx on public.sync_jobs (video_id);
create index sync_jobs_status_idx on public.sync_jobs (status);
create index sync_jobs_started_at_idx on public.sync_jobs (started_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.campaigns enable row level security;
alter table public.creators enable row level security;
alter table public.campaign_creators enable row level security;
alter table public.videos enable row level security;
alter table public.video_metric_snapshots enable row level security;
alter table public.sound_metric_snapshots enable row level security;
alter table public.reports enable row level security;
alter table public.sync_jobs enable row level security;

-- Policies are intentionally omitted. Internal authenticated policies will be
-- added when auth is introduced. Until then, all direct table access is denied.
