-- Per-creator follower growth bounds in a single round trip.
--
-- The creator directory and the campaign creator summaries need exactly two
-- snapshots per creator: the earliest one (growth baseline) and the latest one
-- (current follower count). They previously read the entire series for every
-- creator in one PostgREST query and reduced it in application code, which
-- silently truncated at the default row cap once the table grew past it. Rows
-- arrive ordered by capture time, so the truncation kept each creator's oldest
-- snapshots and dropped the recent ones — the list then reported a months-old
-- follower count as current, and sorted by it.
--
-- Reading the bounds in SQL keeps the result at one row per creator, so these
-- surfaces stay correct however long the history gets. Both lateral lookups hit
-- creator_metric_snapshots_creator_id_captured_at_idx.

create or replace function public.creator_growth_bounds(p_creator_ids uuid[])
returns table (
  creator_id uuid,
  snapshot_count integer,
  first_follower_count bigint,
  first_captured_at timestamptz,
  latest_follower_count bigint,
  latest_captured_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    counted.creator_id,
    counted.snapshot_count,
    earliest.follower_count,
    earliest.captured_at,
    latest.follower_count,
    latest.captured_at
  from (
    select s.creator_id, count(*)::integer as snapshot_count
    from public.creator_metric_snapshots s
    where s.creator_id = any (p_creator_ids)
    group by s.creator_id
  ) counted
  join lateral (
    select s.follower_count, s.captured_at
    from public.creator_metric_snapshots s
    where s.creator_id = counted.creator_id
    order by s.captured_at asc
    limit 1
  ) earliest on true
  join lateral (
    select s.follower_count, s.captured_at
    from public.creator_metric_snapshots s
    where s.creator_id = counted.creator_id
    order by s.captured_at desc
    limit 1
  ) latest on true;
$$;

comment on function public.creator_growth_bounds(uuid[]) is
  'Earliest and latest follower snapshot per creator. Read path for the creator directory and campaign creator summaries. Security invoker: the existing creator_metric_snapshots select policy still applies.';

-- Internal read only: this is not a public-share RPC, so anon gets nothing.
revoke all on function public.creator_growth_bounds(uuid[]) from public;
revoke all on function public.creator_growth_bounds(uuid[]) from anon;
grant execute on function public.creator_growth_bounds(uuid[]) to authenticated;
