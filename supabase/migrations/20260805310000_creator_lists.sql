-- BeFluencer Reports — Creator List Builder (Phase 18)
--
-- Curated creator selections for internal management + revocable public shares.
-- Public access is live membership (creator_list_items) with current public
-- creator fields — not an immutable report snapshot.
-- Raw share tokens are never stored — only SHA-256 hashes.
-- Public access goes through security-definer RPCs; anon has no table privileges.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- creator_lists
-- ---------------------------------------------------------------------------

create table if not exists public.creator_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  internal_notes text,
  status text not null default 'draft',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint creator_lists_status_allowed
    check (status in ('draft', 'ready', 'archived')),
  constraint creator_lists_name_trimmed_nonempty
    check (char_length(btrim(name)) > 0),
  constraint creator_lists_name_length
    check (char_length(name) <= 120),
  constraint creator_lists_description_length
    check (description is null or char_length(description) <= 1000),
  constraint creator_lists_internal_notes_length
    check (internal_notes is null or char_length(internal_notes) <= 5000)
);

comment on table public.creator_lists is
  'Named curated creator selections for internal use and optional public sharing.';

comment on column public.creator_lists.internal_notes is
  'Internal-only notes. Never exposed via public RPCs.';

create index if not exists creator_lists_created_at_idx
  on public.creator_lists (created_at desc);

create index if not exists creator_lists_status_updated_at_idx
  on public.creator_lists (status, updated_at desc);

create or replace function public.set_creator_lists_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists creator_lists_set_updated_at on public.creator_lists;

create trigger creator_lists_set_updated_at
before update on public.creator_lists
for each row
execute function public.set_creator_lists_updated_at();

-- ---------------------------------------------------------------------------
-- creator_list_items
-- ---------------------------------------------------------------------------

create table if not exists public.creator_list_items (
  id uuid primary key default gen_random_uuid(),
  creator_list_id uuid not null
    references public.creator_lists (id) on delete cascade,
  creator_id uuid not null
    references public.creators (id) on delete cascade,
  position integer not null default 0,
  public_note text,
  internal_note text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint creator_list_items_unique_creator
    unique (creator_list_id, creator_id),
  constraint creator_list_items_position_nonnegative
    check (position >= 0),
  constraint creator_list_items_public_note_length
    check (public_note is null or char_length(public_note) <= 500),
  constraint creator_list_items_internal_note_length
    check (internal_note is null or char_length(internal_note) <= 2000)
);

comment on column public.creator_list_items.internal_note is
  'Internal-only per-item note. Never exposed via public RPCs.';

comment on column public.creator_list_items.public_note is
  'Optional note safe to show on public creator-list shares.';

create index if not exists creator_list_items_list_position_idx
  on public.creator_list_items (creator_list_id, position);

create index if not exists creator_list_items_creator_id_idx
  on public.creator_list_items (creator_id);

-- ---------------------------------------------------------------------------
-- creator_list_shares
-- ---------------------------------------------------------------------------

create table if not exists public.creator_list_shares (
  id uuid primary key default gen_random_uuid(),
  creator_list_id uuid not null
    references public.creator_lists (id) on delete cascade,
  token_hash text not null unique,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  access_count bigint not null default 0,
  label text,
  allow_csv_download boolean not null default true,
  constraint creator_list_shares_token_hash_sha256
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint creator_list_shares_access_count_nonnegative
    check (access_count >= 0),
  constraint creator_list_shares_expires_after_created
    check (expires_at is null or expires_at > created_at),
  constraint creator_list_shares_label_length
    check (label is null or char_length(label) <= 120)
);

comment on table public.creator_list_shares is
  'Revocable public links to creator lists. Stores SHA-256 of the raw token only.';

comment on column public.creator_list_shares.token_hash is
  'SHA-256 hex digest of the raw share token. The raw token is never stored.';

create index if not exists creator_list_shares_list_created_at_idx
  on public.creator_list_shares (creator_list_id, created_at desc);

create index if not exists creator_list_shares_expires_at_idx
  on public.creator_list_shares (expires_at);

create index if not exists creator_list_shares_revoked_at_idx
  on public.creator_list_shares (revoked_at);

-- ---------------------------------------------------------------------------
-- Idempotent page-access nonces
-- ---------------------------------------------------------------------------

create table if not exists public.creator_list_share_access_events (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null
    references public.creator_list_shares (id) on delete cascade,
  nonce text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint creator_list_share_access_events_nonce_format
    check (nonce ~ '^[0-9a-f]{32}$'),
  constraint creator_list_share_access_events_share_nonce_unique
    unique (share_id, nonce)
);

create index if not exists creator_list_share_access_events_created_at_idx
  on public.creator_list_share_access_events (created_at);

alter table public.creator_list_share_access_events enable row level security;

revoke all on public.creator_list_share_access_events from anon;
revoke all on public.creator_list_share_access_events from authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.creator_lists enable row level security;
alter table public.creator_list_items enable row level security;
alter table public.creator_list_shares enable row level security;

revoke all on public.creator_lists from anon;
revoke all on public.creator_list_items from anon;
revoke all on public.creator_list_shares from anon;

revoke all on public.creator_lists from authenticated;
revoke all on public.creator_list_items from authenticated;
revoke all on public.creator_list_shares from authenticated;

grant select, insert, update, delete on public.creator_lists to authenticated;
grant select, insert, update, delete on public.creator_list_items to authenticated;
grant select, insert, update on public.creator_list_shares to authenticated;

drop policy if exists creator_lists_authenticated_select on public.creator_lists;
drop policy if exists creator_lists_authenticated_insert on public.creator_lists;
drop policy if exists creator_lists_authenticated_update on public.creator_lists;
drop policy if exists creator_lists_authenticated_delete on public.creator_lists;

create policy creator_lists_authenticated_select
  on public.creator_lists for select to authenticated using (true);

create policy creator_lists_authenticated_insert
  on public.creator_lists for insert to authenticated
  with check (created_by is null or created_by = auth.uid());

create policy creator_lists_authenticated_update
  on public.creator_lists for update to authenticated
  using (true) with check (true);

create policy creator_lists_authenticated_delete
  on public.creator_lists for delete to authenticated using (true);

drop policy if exists creator_list_items_authenticated_select on public.creator_list_items;
drop policy if exists creator_list_items_authenticated_insert on public.creator_list_items;
drop policy if exists creator_list_items_authenticated_update on public.creator_list_items;
drop policy if exists creator_list_items_authenticated_delete on public.creator_list_items;

create policy creator_list_items_authenticated_select
  on public.creator_list_items for select to authenticated using (true);

create policy creator_list_items_authenticated_insert
  on public.creator_list_items for insert to authenticated with check (true);

create policy creator_list_items_authenticated_update
  on public.creator_list_items for update to authenticated
  using (true) with check (true);

create policy creator_list_items_authenticated_delete
  on public.creator_list_items for delete to authenticated using (true);

drop policy if exists creator_list_shares_authenticated_select on public.creator_list_shares;
drop policy if exists creator_list_shares_authenticated_insert on public.creator_list_shares;
drop policy if exists creator_list_shares_authenticated_update on public.creator_list_shares;

create policy creator_list_shares_authenticated_select
  on public.creator_list_shares for select to authenticated using (true);

create policy creator_list_shares_authenticated_insert
  on public.creator_list_shares for insert to authenticated
  with check (created_by = auth.uid());

create policy creator_list_shares_authenticated_update
  on public.creator_list_shares for update to authenticated
  using (true) with check (true);

create or replace function public.guard_creator_list_share_update()
returns trigger
language plpgsql
as $$
begin
  if new.token_hash is distinct from old.token_hash
     or new.creator_list_id is distinct from old.creator_list_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at
  then
    raise exception 'creator_list_shares identity fields are immutable';
  end if;

  if (
       new.access_count is distinct from old.access_count
       or new.last_accessed_at is distinct from old.last_accessed_at
     )
     and current_user in ('anon', 'authenticated')
  then
    raise exception 'creator_list_shares access fields are not client-writable';
  end if;

  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'revoked creator_list_shares cannot be reactivated';
  end if;

  return new;
end;
$$;

drop trigger if exists creator_list_shares_guard_update on public.creator_list_shares;

create trigger creator_list_shares_guard_update
before update on public.creator_list_shares
for each row
execute function public.guard_creator_list_share_update();

-- ---------------------------------------------------------------------------
-- Usability helper (list must not be archived for public access)
-- ---------------------------------------------------------------------------

create or replace function public._creator_list_share_is_usable(
  p_revoked_at timestamptz,
  p_expires_at timestamptz,
  p_list_status text
)
returns boolean
language sql
stable
as $$
  select p_revoked_at is null
     and (p_expires_at is null or p_expires_at > timezone('utc', now()))
     and p_list_status in ('draft', 'ready');
$$;

-- Builds approved public creator rows + stats. Never includes internal notes,
-- fees, sync errors, contact fields, or creator UUIDs.
create or replace function public._build_public_creator_list_payload(p_list_id uuid)
returns table (
  creators jsonb,
  stats jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
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
    join public.creators c on c.id = i.creator_id
    where i.creator_list_id = p_list_id
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
-- resolve_public_creator_list — SSR (does NOT increment)
-- ---------------------------------------------------------------------------

create or replace function public.resolve_public_creator_list(p_raw_token text)
returns table (
  share_id uuid,
  list_name text,
  description text,
  allow_csv_download boolean,
  expires_at timestamptz,
  label text,
  creators jsonb,
  stats jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hash text;
  v_share_id uuid;
  v_list_id uuid;
  v_list_name text;
  v_description text;
  v_allow_csv boolean;
  v_expires_at timestamptz;
  v_label text;
  v_creators jsonb;
  v_stats jsonb;
begin
  if p_raw_token is null or p_raw_token !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  v_hash := encode(digest(p_raw_token, 'sha256'), 'hex');

  select s.id, l.id, l.name, l.description, s.allow_csv_download, s.expires_at, s.label
    into v_share_id, v_list_id, v_list_name, v_description, v_allow_csv, v_expires_at, v_label
    from public.creator_list_shares s
    join public.creator_lists l on l.id = s.creator_list_id
   where s.token_hash = v_hash
     and public._creator_list_share_is_usable(s.revoked_at, s.expires_at, l.status);

  if v_share_id is null then
    return;
  end if;

  select p.creators, p.stats
    into v_creators, v_stats
    from public._build_public_creator_list_payload(v_list_id) p;

  return query
    select v_share_id,
           v_list_name,
           v_description,
           v_allow_csv,
           v_expires_at,
           v_label,
           coalesce(v_creators, '[]'::jsonb),
           coalesce(v_stats, '{}'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- consume_public_creator_list — page access beacon (idempotent via nonce)
-- ---------------------------------------------------------------------------

create or replace function public.consume_public_creator_list(
  p_raw_token text,
  p_access_nonce text default null
)
returns table (
  share_id uuid,
  list_name text,
  description text,
  allow_csv_download boolean,
  expires_at timestamptz,
  label text,
  creators jsonb,
  stats jsonb,
  access_recorded boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hash text;
  v_share_id uuid;
  v_list_id uuid;
  v_recorded boolean := false;
  v_row record;
begin
  if p_raw_token is null or p_raw_token !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  v_hash := encode(digest(p_raw_token, 'sha256'), 'hex');

  select s.id, s.creator_list_id
    into v_share_id, v_list_id
    from public.creator_list_shares s
    join public.creator_lists l on l.id = s.creator_list_id
   where s.token_hash = v_hash
     and public._creator_list_share_is_usable(s.revoked_at, s.expires_at, l.status);

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
    select v_row.share_id,
           v_row.list_name,
           v_row.description,
           v_row.allow_csv_download,
           v_row.expires_at,
           v_row.label,
           v_row.creators,
           v_row.stats,
           v_recorded;
end;
$$;

-- ---------------------------------------------------------------------------
-- consume_public_creator_list_csv — CSV download (increments once)
-- ---------------------------------------------------------------------------

create or replace function public.consume_public_creator_list_csv(p_raw_token text)
returns table (
  share_id uuid,
  list_name text,
  description text,
  allow_csv_download boolean,
  creators jsonb,
  stats jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hash text;
  v_share_id uuid;
  v_list_id uuid;
  v_list_name text;
  v_description text;
  v_creators jsonb;
  v_stats jsonb;
begin
  if p_raw_token is null or p_raw_token !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  v_hash := encode(digest(p_raw_token, 'sha256'), 'hex');

  update public.creator_list_shares s
     set access_count = s.access_count + 1,
         last_accessed_at = timezone('utc', now())
    from public.creator_lists l
   where s.token_hash = v_hash
     and s.creator_list_id = l.id
     and s.allow_csv_download = true
     and public._creator_list_share_is_usable(s.revoked_at, s.expires_at, l.status)
  returning s.id, s.creator_list_id, l.name, l.description
    into v_share_id, v_list_id, v_list_name, v_description;

  if v_share_id is null then
    return;
  end if;

  select p.creators, p.stats
    into v_creators, v_stats
    from public._build_public_creator_list_payload(v_list_id) p;

  return query
    select v_share_id,
           v_list_name,
           v_description,
           true,
           coalesce(v_creators, '[]'::jsonb),
           coalesce(v_stats, '{}'::jsonb);
end;
$$;

revoke all on function public._creator_list_share_is_usable(timestamptz, timestamptz, text) from public;
revoke all on function public._build_public_creator_list_payload(uuid) from public;
revoke all on function public.resolve_public_creator_list(text) from public;
revoke all on function public.consume_public_creator_list(text, text) from public;
revoke all on function public.consume_public_creator_list_csv(text) from public;

grant execute on function public.resolve_public_creator_list(text) to anon, authenticated;
grant execute on function public.consume_public_creator_list(text, text) to anon, authenticated;
grant execute on function public.consume_public_creator_list_csv(text) to anon, authenticated;

comment on function public.resolve_public_creator_list(text) is
  'Validates a creator-list share token and returns public list fields without incrementing access_count.';

comment on function public.consume_public_creator_list(text, text) is
  'Records one page access when a fresh 32-hex nonce is supplied. Never returns token_hash or internal notes.';

comment on function public.consume_public_creator_list_csv(text) is
  'Validates share, requires allow_csv_download, increments access_count once per CSV request.';
