-- Creator category automation
--
-- Bulk-imported creators start uncategorized (category IS NULL) until a TikTok
-- profile sync supplies a real follower count. Manual selections are protected
-- via category_source = 'manual'.

-- Expand allowed tiers: nano / micro / macro / mega (+ legacy template).
alter table public.creators
  drop constraint if exists creators_category_check;

alter table public.creators
  alter column category drop not null;

alter table public.creators
  alter column category drop default;

alter table public.creators
  add constraint creators_category_check
  check (
    category is null
    or category in ('nano', 'micro', 'macro', 'mega', 'template')
  );

alter table public.creators
  add column if not exists category_source text not null default 'auto';

alter table public.creators
  drop constraint if exists creators_category_source_check;

alter table public.creators
  add constraint creators_category_source_check
  check (category_source in ('auto', 'manual'));

-- Existing classified rows keep their category and become manual so sync does
-- not rewrite agency-curated tiers unexpectedly.
update public.creators
set category_source = 'manual'
where category is not null;

comment on column public.creators.category is
  'Audience tier derived from follower_count when category_source = auto. Null means uncategorized (below 1k or unknown). Legacy template remains for curated rows.';

comment on column public.creators.category_source is
  'auto = recalculate from follower_count on successful profile sync; manual = never overwrite via sync.';
