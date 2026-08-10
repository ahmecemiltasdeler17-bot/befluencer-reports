-- Dual sound metrics: original (single-page / Apify) vs cluster (total Contains usage).
-- Existing rows are treated as original. Unique capture times are per metric series.

alter table public.sound_metric_snapshots
  add column if not exists metric_type text not null default 'original';

alter table public.sound_metric_snapshots
  add column if not exists note text;

alter table public.sound_metric_snapshots
  drop constraint if exists sound_metric_snapshots_metric_type_check;

alter table public.sound_metric_snapshots
  add constraint sound_metric_snapshots_metric_type_check
  check (metric_type in ('original', 'cluster'));

comment on column public.sound_metric_snapshots.metric_type is
  'original = TikTok single music-page usage (Apify/manual); cluster = total Contains/catalog usage (manual).';

comment on column public.sound_metric_snapshots.note is
  'Optional admin note for a measurement (typically cluster/manual). Never shown as customer-facing source.';

-- Safe backfill for any pre-default or null rows (defensive).
update public.sound_metric_snapshots
set metric_type = 'original'
where metric_type is null
   or metric_type not in ('original', 'cluster');

drop index if exists sound_metric_snapshots_campaign_id_captured_at_uidx;

create unique index if not exists sound_metric_snapshots_campaign_metric_captured_uidx
  on public.sound_metric_snapshots (campaign_id, metric_type, captured_at);

create index if not exists sound_metric_snapshots_campaign_metric_captured_idx
  on public.sound_metric_snapshots (campaign_id, metric_type, captured_at desc);
