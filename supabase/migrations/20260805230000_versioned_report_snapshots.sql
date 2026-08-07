-- BeFluencer Reports — versioned report snapshots
-- Immutable historical report versions stored as JSONB snapshots.

-- ---------------------------------------------------------------------------
-- reports series: one logical report per campaign
-- ---------------------------------------------------------------------------

create unique index if not exists reports_campaign_id_uidx
  on public.reports (campaign_id);

comment on table public.reports is
  'Report series identity for a campaign. Versioned snapshots live in report_versions.';

-- ---------------------------------------------------------------------------
-- report_versions
-- ---------------------------------------------------------------------------

create table if not exists public.report_versions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  version_number integer not null,
  status text not null default 'generating',
  generated_at timestamptz,
  generated_by uuid references auth.users (id) on delete set null,
  source_last_synced_at timestamptz,
  source_video_count integer not null default 0,
  source_creator_count integer not null default 0,
  snapshot_schema_version integer not null default 1,
  snapshot jsonb not null default '{}'::jsonb,
  content_hash text,
  error_message text,
  archived_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint report_versions_version_number_positive check (version_number >= 1),
  constraint report_versions_status_allowed check (
    status in ('generating', 'ready', 'failed', 'archived')
  ),
  constraint report_versions_snapshot_is_object check (jsonb_typeof(snapshot) = 'object'),
  constraint report_versions_source_video_count_nonnegative check (source_video_count >= 0),
  constraint report_versions_source_creator_count_nonnegative check (source_creator_count >= 0),
  constraint report_versions_report_version_unique unique (report_id, version_number)
);

comment on table public.report_versions is
  'Immutable versioned report snapshots. Ready/archived rows must not mutate snapshot content.';

comment on column public.report_versions.status is
  'Lifecycle: generating → ready|failed; ready → archived.';

comment on column public.report_versions.snapshot is
  'Full JSON snapshot for rendering the approved report UI without live queries.';

comment on column public.report_versions.content_hash is
  'SHA-256 of canonical snapshot content excluding generation metadata.';

create index if not exists report_versions_report_id_version_desc_idx
  on public.report_versions (report_id, version_number desc);

create index if not exists report_versions_campaign_id_created_at_desc_idx
  on public.report_versions (campaign_id, created_at desc);

create index if not exists report_versions_status_idx
  on public.report_versions (status);

create index if not exists report_versions_content_hash_idx
  on public.report_versions (content_hash);

create index if not exists report_versions_generated_at_desc_idx
  on public.report_versions (generated_at desc nulls last);

drop trigger if exists report_versions_set_updated_at on public.report_versions;

create trigger report_versions_set_updated_at
before update on public.report_versions
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Immutability guard for ready/archived snapshots
-- ---------------------------------------------------------------------------

create or replace function public.guard_report_version_immutability()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.status in ('ready', 'archived') then
    if new.snapshot is distinct from old.snapshot
      or new.content_hash is distinct from old.content_hash
      or new.version_number is distinct from old.version_number
      or new.report_id is distinct from old.report_id
      or new.campaign_id is distinct from old.campaign_id
      or new.generated_at is distinct from old.generated_at
      or new.snapshot_schema_version is distinct from old.snapshot_schema_version
    then
      raise exception 'Immutable report version snapshot cannot be modified.';
    end if;

    if old.status = 'ready' and new.status not in ('ready', 'archived') then
      raise exception 'Ready report version may only transition to archived.';
    end if;

    if old.status = 'archived' and new.status <> 'archived' then
      raise exception 'Archived report version status cannot change.';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.guard_report_version_immutability() is
  'Prevents mutation of snapshot content after a version becomes ready or archived.';

drop trigger if exists report_versions_guard_immutability on public.report_versions;

create trigger report_versions_guard_immutability
before update on public.report_versions
for each row execute function public.guard_report_version_immutability();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.report_versions enable row level security;

revoke all on public.report_versions from anon;
grant select, insert, update, delete on public.report_versions to authenticated;

drop policy if exists report_versions_authenticated_select on public.report_versions;
drop policy if exists report_versions_authenticated_insert on public.report_versions;
drop policy if exists report_versions_authenticated_update on public.report_versions;
drop policy if exists report_versions_authenticated_delete on public.report_versions;

create policy report_versions_authenticated_select
  on public.report_versions
  for select
  to authenticated
  using (true);

create policy report_versions_authenticated_insert
  on public.report_versions
  for insert
  to authenticated
  with check (true);

create policy report_versions_authenticated_update
  on public.report_versions
  for update
  to authenticated
  using (true)
  with check (true);

create policy report_versions_authenticated_delete
  on public.report_versions
  for delete
  to authenticated
  using (true);
