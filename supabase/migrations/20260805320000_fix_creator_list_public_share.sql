-- Fix public creator-list share resolve/consume: digest() lives in extensions
-- on Supabase. Phase 18 RPCs used search_path = public, pg_temp, so anon
-- resolve failed with SQLSTATE 42883 (function digest(text, unknown) does not
-- exist) and every /lists/<token> link rendered as unavailable.

create extension if not exists pgcrypto with schema extensions;

-- RETURNS TABLE shape changes require DROP (CREATE OR REPLACE cannot alter OUT cols).
drop function if exists public.consume_public_creator_list_csv(text);
drop function if exists public.consume_public_creator_list(text, text);
drop function if exists public.resolve_public_creator_list(text);
drop function if exists public._build_public_creator_list_payload(uuid);

-- ---------------------------------------------------------------------------
-- Payload builder (LEFT JOIN + safe search_path)
-- ---------------------------------------------------------------------------

create or replace function public._build_public_creator_list_payload(p_list_id uuid)
returns table (
  creators jsonb,
  stats jsonb
)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  with ordered as (
    select
      i.position,
      c.username,
      c.display_name,
      c.profile_url,
      c.avatar_url,
      c.platform,
      c.category,
      c.follower_count,
      i.public_note
    from public.creator_list_items i
    left join public.creators c on c.id = i.creator_id
    where i.creator_list_id = p_list_id
      and c.id is not null
    order by i.position asc, i.created_at asc
  )
  select
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'position', o.position,
            'username', o.username,
            'display_name', o.display_name,
            'profile_url', o.profile_url,
            'avatar_url', o.avatar_url,
            'platform', o.platform,
            'category', o.category,
            'follower_count', o.follower_count,
            'public_note', o.public_note
          )
          order by o.position asc
        )
        from ordered o
      ),
      '[]'::jsonb
    ) as creators,
    jsonb_build_object(
      'creator_count', (select count(*)::integer from ordered),
      'total_followers', (select coalesce(sum(follower_count), 0)::bigint from ordered),
      'platform_distribution', (
        select coalesce(jsonb_object_agg(platform, cnt), '{}'::jsonb)
        from (
          select platform, count(*)::integer as cnt
          from ordered
          group by platform
        ) p
      ),
      'category_distribution', (
        select coalesce(
          jsonb_object_agg(coalesce(category, 'uncategorized'), cnt),
          '{}'::jsonb
        )
        from (
          select category, count(*)::integer as cnt
          from ordered
          group by category
        ) c
      )
    ) as stats;
$$;

-- ---------------------------------------------------------------------------
-- resolve_public_creator_list
-- ---------------------------------------------------------------------------

create or replace function public.resolve_public_creator_list(p_raw_token text)
returns table (
  share_id uuid,
  list_id uuid,
  list_name text,
  description text,
  status text,
  allow_csv_download boolean,
  expires_at timestamptz,
  label text,
  creator_count integer,
  creators jsonb,
  stats jsonb
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_hash text;
  v_share_id uuid;
  v_list_id uuid;
  v_list_name text;
  v_description text;
  v_status text;
  v_allow_csv boolean;
  v_expires_at timestamptz;
  v_label text;
  v_creators jsonb;
  v_stats jsonb;
  v_creator_count integer;
begin
  if p_raw_token is null or p_raw_token !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  -- Match Node: createHash('sha256').update(rawToken, 'utf8').digest('hex')
  v_hash := encode(
    extensions.digest(convert_to(p_raw_token, 'UTF8'), 'sha256'),
    'hex'
  );

  select s.id,
         l.id,
         l.name,
         l.description,
         l.status,
         s.allow_csv_download,
         s.expires_at,
         s.label
    into v_share_id,
         v_list_id,
         v_list_name,
         v_description,
         v_status,
         v_allow_csv,
         v_expires_at,
         v_label
    from public.creator_list_shares s
    join public.creator_lists l on l.id = s.creator_list_id
   where s.token_hash = v_hash
     and public._creator_list_share_is_usable(
           s.revoked_at, s.expires_at, l.status
         );

  if v_share_id is null then
    return;
  end if;

  select p.creators, p.stats
    into v_creators, v_stats
    from public._build_public_creator_list_payload(v_list_id) p;

  v_creators := coalesce(v_creators, '[]'::jsonb);
  v_stats := coalesce(v_stats, '{}'::jsonb);
  v_creator_count := coalesce((v_stats ->> 'creator_count')::integer, 0);

  return query
    select v_share_id as share_id,
           v_list_id as list_id,
           v_list_name as list_name,
           v_description as description,
           v_status as status,
           v_allow_csv as allow_csv_download,
           v_expires_at as expires_at,
           v_label as label,
           v_creator_count as creator_count,
           v_creators as creators,
           v_stats as stats;
end;
$$;

-- ---------------------------------------------------------------------------
-- consume_public_creator_list
-- ---------------------------------------------------------------------------

create or replace function public.consume_public_creator_list(
  p_raw_token text,
  p_access_nonce text default null
)
returns table (
  share_id uuid,
  list_id uuid,
  list_name text,
  description text,
  status text,
  allow_csv_download boolean,
  expires_at timestamptz,
  label text,
  creator_count integer,
  creators jsonb,
  stats jsonb,
  access_recorded boolean
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_hash text;
  v_share_id uuid;
  v_recorded boolean := false;
  v_row record;
begin
  if p_raw_token is null or p_raw_token !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  v_hash := encode(
    extensions.digest(convert_to(p_raw_token, 'UTF8'), 'sha256'),
    'hex'
  );

  select s.id
    into v_share_id
    from public.creator_list_shares s
    join public.creator_lists l on l.id = s.creator_list_id
   where s.token_hash = v_hash
     and public._creator_list_share_is_usable(
           s.revoked_at, s.expires_at, l.status
         );

  if v_share_id is null then
    return;
  end if;

  if p_access_nonce is not null and p_access_nonce ~ '^[0-9a-f]{32}$' then
    begin
      insert into public.creator_list_share_access_events (share_id, nonce)
      values (v_share_id, p_access_nonce);

      update public.creator_list_shares
         set access_count = access_count + 1,
             last_accessed_at = timezone('utc', now())
       where id = v_share_id;

      v_recorded := true;
    exception
      when unique_violation then
        v_recorded := false;
    end;
  end if;

  select * into v_row
    from public.resolve_public_creator_list(p_raw_token);

  if v_row.share_id is null then
    return;
  end if;

  return query
    select v_row.share_id as share_id,
           v_row.list_id as list_id,
           v_row.list_name as list_name,
           v_row.description as description,
           v_row.status as status,
           v_row.allow_csv_download as allow_csv_download,
           v_row.expires_at as expires_at,
           v_row.label as label,
           v_row.creator_count as creator_count,
           v_row.creators as creators,
           v_row.stats as stats,
           v_recorded as access_recorded;
end;
$$;

-- ---------------------------------------------------------------------------
-- consume_public_creator_list_csv
-- ---------------------------------------------------------------------------

create or replace function public.consume_public_creator_list_csv(p_raw_token text)
returns table (
  share_id uuid,
  list_id uuid,
  list_name text,
  description text,
  status text,
  allow_csv_download boolean,
  creator_count integer,
  creators jsonb,
  stats jsonb
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_hash text;
  v_share_id uuid;
  v_list_id uuid;
  v_list_name text;
  v_description text;
  v_status text;
  v_creators jsonb;
  v_stats jsonb;
  v_creator_count integer;
begin
  if p_raw_token is null or p_raw_token !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  v_hash := encode(
    extensions.digest(convert_to(p_raw_token, 'UTF8'), 'sha256'),
    'hex'
  );

  update public.creator_list_shares s
     set access_count = s.access_count + 1,
         last_accessed_at = timezone('utc', now())
    from public.creator_lists l
   where s.token_hash = v_hash
     and s.creator_list_id = l.id
     and s.allow_csv_download = true
     and public._creator_list_share_is_usable(
           s.revoked_at, s.expires_at, l.status
         )
  returning s.id, s.creator_list_id, l.name, l.description, l.status
    into v_share_id, v_list_id, v_list_name, v_description, v_status;

  if v_share_id is null then
    return;
  end if;

  select p.creators, p.stats
    into v_creators, v_stats
    from public._build_public_creator_list_payload(v_list_id) p;

  v_creators := coalesce(v_creators, '[]'::jsonb);
  v_stats := coalesce(v_stats, '{}'::jsonb);
  v_creator_count := coalesce((v_stats ->> 'creator_count')::integer, 0);

  return query
    select v_share_id as share_id,
           v_list_id as list_id,
           v_list_name as list_name,
           v_description as description,
           v_status as status,
           true as allow_csv_download,
           v_creator_count as creator_count,
           v_creators as creators,
           v_stats as stats;
end;
$$;

revoke all on function public._build_public_creator_list_payload(uuid) from public;
revoke all on function public.resolve_public_creator_list(text) from public;
revoke all on function public.consume_public_creator_list(text, text) from public;
revoke all on function public.consume_public_creator_list_csv(text) from public;

grant execute on function public.resolve_public_creator_list(text)
  to anon, authenticated;
grant execute on function public.consume_public_creator_list(text, text)
  to anon, authenticated;
grant execute on function public.consume_public_creator_list_csv(text)
  to anon, authenticated;

comment on function public.resolve_public_creator_list(text) is
  'Validates a creator-list share token with extensions.digest; returns public fields only; no access_count increment.';

comment on function public.consume_public_creator_list(text, text) is
  'Idempotent page access for creator-list shares. Never returns token_hash or internal notes.';

comment on function public.consume_public_creator_list_csv(text) is
  'CSV download consume for creator-list shares; requires allow_csv_download.';
