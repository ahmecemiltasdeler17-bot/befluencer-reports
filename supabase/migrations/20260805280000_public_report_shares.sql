-- BeFluencer Reports — public report sharing
--
-- Phase 13: revocable, optionally expiring public links for immutable
-- report_versions only. Raw share tokens are never stored — only SHA-256 hashes.
-- Public access goes through security-definer RPCs; anon has no table privileges.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- public_report_shares
-- ---------------------------------------------------------------------------

create table if not exists public.public_report_shares (
  id uuid primary key default gen_random_uuid(),
  report_version_id uuid not null
    references public.report_versions (id) on delete cascade,
  token_hash text not null unique,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  access_count bigint not null default 0,
  label text,
  allow_pdf_download boolean not null default true,
  constraint public_report_shares_token_hash_sha256
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint public_report_shares_access_count_nonnegative
    check (access_count >= 0),
  constraint public_report_shares_expires_after_created
    check (expires_at is null or expires_at > created_at),
  constraint public_report_shares_label_length
    check (label is null or char_length(label) <= 120)
);

comment on table public.public_report_shares is
  'Revocable public links to immutable report_versions. Stores SHA-256 of the raw token only.';

comment on column public.public_report_shares.token_hash is
  'SHA-256 hex digest of the raw share token. The raw token is never stored.';

comment on column public.public_report_shares.revoked_at is
  'When set, the share is permanently unusable. Prefer revoke over delete.';

create index if not exists public_report_shares_version_created_at_idx
  on public.public_report_shares (report_version_id, created_at desc);

create index if not exists public_report_shares_expires_at_idx
  on public.public_report_shares (expires_at);

create index if not exists public_report_shares_revoked_at_idx
  on public.public_report_shares (revoked_at);

-- ---------------------------------------------------------------------------
-- Idempotent page-access nonces (prevents double-count from remount/retries)
-- ---------------------------------------------------------------------------

create table if not exists public.public_report_share_access_events (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null
    references public.public_report_shares (id) on delete cascade,
  nonce text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint public_report_share_access_events_nonce_format
    check (nonce ~ '^[0-9a-f]{32}$'),
  constraint public_report_share_access_events_share_nonce_unique
    unique (share_id, nonce)
);

create index if not exists public_report_share_access_events_created_at_idx
  on public.public_report_share_access_events (created_at);

alter table public.public_report_share_access_events enable row level security;

revoke all on public.public_report_share_access_events from anon;
revoke all on public.public_report_share_access_events from authenticated;

-- ---------------------------------------------------------------------------
-- RLS for public_report_shares
-- ---------------------------------------------------------------------------

alter table public.public_report_shares enable row level security;

revoke all on public.public_report_shares from anon;
revoke all on public.public_report_shares from authenticated;

grant select, insert, update on public.public_report_shares to authenticated;

drop policy if exists public_report_shares_authenticated_select
  on public.public_report_shares;
drop policy if exists public_report_shares_authenticated_insert
  on public.public_report_shares;
drop policy if exists public_report_shares_authenticated_update
  on public.public_report_shares;

create policy public_report_shares_authenticated_select
  on public.public_report_shares
  for select
  to authenticated
  using (true);

create policy public_report_shares_authenticated_insert
  on public.public_report_shares
  for insert
  to authenticated
  with check (created_by = auth.uid());

create policy public_report_shares_authenticated_update
  on public.public_report_shares
  for update
  to authenticated
  using (true)
  with check (true);

-- Prevent identity fields from being rewritten. Access counters may only change
-- inside security-definer RPCs (current_user = function owner), not via the
-- authenticated PostgREST role.
create or replace function public.guard_public_report_share_update()
returns trigger
language plpgsql
as $$
begin
  if new.token_hash is distinct from old.token_hash
     or new.report_version_id is distinct from old.report_version_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at
  then
    raise exception 'public_report_shares identity fields are immutable';
  end if;

  if (
       new.access_count is distinct from old.access_count
       or new.last_accessed_at is distinct from old.last_accessed_at
     )
     and current_user in ('anon', 'authenticated')
  then
    raise exception 'public_report_shares access fields are not client-writable';
  end if;

  -- Revocation is one-way.
  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'revoked public_report_shares cannot be reactivated';
  end if;

  return new;
end;
$$;

drop trigger if exists public_report_shares_guard_update on public.public_report_shares;

create trigger public_report_shares_guard_update
before update on public.public_report_shares
for each row
execute function public.guard_public_report_share_update();

-- ---------------------------------------------------------------------------
-- Shared validation helper
-- ---------------------------------------------------------------------------

create or replace function public._public_report_share_is_usable(
  p_revoked_at timestamptz,
  p_expires_at timestamptz,
  p_version_status text
)
returns boolean
language sql
stable
as $$
  select p_revoked_at is null
     and (p_expires_at is null or p_expires_at > timezone('utc', now()))
     and p_version_status in ('ready', 'archived');
$$;

-- ---------------------------------------------------------------------------
-- resolve_public_report_share — SSR load (does NOT increment access_count)
-- ---------------------------------------------------------------------------

create or replace function public.resolve_public_report_share(p_raw_token text)
returns table (
  share_id uuid,
  report_version_id uuid,
  campaign_id uuid,
  version_number integer,
  status text,
  generated_at timestamptz,
  snapshot jsonb,
  campaign_name text,
  report_number text,
  allow_pdf_download boolean,
  expires_at timestamptz,
  label text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hash text;
begin
  if p_raw_token is null or p_raw_token !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  v_hash := encode(digest(p_raw_token, 'sha256'), 'hex');

  return query
    select s.id,
           rv.id,
           rv.campaign_id,
           rv.version_number,
           rv.status,
           rv.generated_at,
           rv.snapshot,
           c.name,
           coalesce(c.report_number, r.report_number),
           s.allow_pdf_download,
           s.expires_at,
           s.label
      from public.public_report_shares s
      join public.report_versions rv on rv.id = s.report_version_id
      join public.campaigns c on c.id = rv.campaign_id
      join public.reports r on r.id = rv.report_id
     where s.token_hash = v_hash
       and public._public_report_share_is_usable(
             s.revoked_at, s.expires_at, rv.status
           );
end;
$$;

-- ---------------------------------------------------------------------------
-- consume_public_report_share — page access beacon (idempotent via nonce)
-- ---------------------------------------------------------------------------

create or replace function public.consume_public_report_share(
  p_raw_token text,
  p_access_nonce text default null
)
returns table (
  share_id uuid,
  report_version_id uuid,
  campaign_id uuid,
  version_number integer,
  status text,
  generated_at timestamptz,
  snapshot jsonb,
  campaign_name text,
  report_number text,
  allow_pdf_download boolean,
  expires_at timestamptz,
  label text,
  access_recorded boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hash text;
  v_share_id uuid;
  v_recorded boolean := false;
begin
  if p_raw_token is null or p_raw_token !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  v_hash := encode(digest(p_raw_token, 'sha256'), 'hex');

  select s.id
    into v_share_id
    from public.public_report_shares s
    join public.report_versions rv on rv.id = s.report_version_id
   where s.token_hash = v_hash
     and public._public_report_share_is_usable(
           s.revoked_at, s.expires_at, rv.status
         );

  if v_share_id is null then
    return;
  end if;

  -- Prefer idempotent beacon: nonce required for increment. Without a valid
  -- nonce, resolve-only payload is returned (access_recorded = false).
  if p_access_nonce is not null and p_access_nonce ~ '^[0-9a-f]{32}$' then
    begin
      insert into public.public_report_share_access_events (share_id, nonce)
      values (v_share_id, p_access_nonce);

      update public.public_report_shares
         set access_count = access_count + 1,
             last_accessed_at = timezone('utc', now())
       where id = v_share_id;

      v_recorded := true;
    exception
      when unique_violation then
        v_recorded := false;
    end;
  end if;

  return query
    select s.id,
           rv.id,
           rv.campaign_id,
           rv.version_number,
           rv.status,
           rv.generated_at,
           rv.snapshot,
           c.name,
           coalesce(c.report_number, r.report_number),
           s.allow_pdf_download,
           s.expires_at,
           s.label,
           v_recorded
      from public.public_report_shares s
      join public.report_versions rv on rv.id = s.report_version_id
      join public.campaigns c on c.id = rv.campaign_id
      join public.reports r on r.id = rv.report_id
     where s.id = v_share_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- consume_public_report_pdf_share — PDF download (increments; requires PDF)
-- ---------------------------------------------------------------------------

create or replace function public.consume_public_report_pdf_share(p_raw_token text)
returns table (
  share_id uuid,
  report_version_id uuid,
  campaign_id uuid,
  version_number integer,
  status text,
  generated_at timestamptz,
  snapshot jsonb,
  campaign_name text,
  report_number text,
  allow_pdf_download boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hash text;
  v_share_id uuid;
begin
  if p_raw_token is null or p_raw_token !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  v_hash := encode(digest(p_raw_token, 'sha256'), 'hex');

  update public.public_report_shares s
     set access_count = s.access_count + 1,
         last_accessed_at = timezone('utc', now())
    from public.report_versions rv
   where s.token_hash = v_hash
     and s.report_version_id = rv.id
     and s.allow_pdf_download = true
     and public._public_report_share_is_usable(
           s.revoked_at, s.expires_at, rv.status
         )
  returning s.id into v_share_id;

  if v_share_id is null then
    return;
  end if;

  return query
    select s.id,
           rv.id,
           rv.campaign_id,
           rv.version_number,
           rv.status,
           rv.generated_at,
           rv.snapshot,
           c.name,
           coalesce(c.report_number, r.report_number),
           s.allow_pdf_download
      from public.public_report_shares s
      join public.report_versions rv on rv.id = s.report_version_id
      join public.campaigns c on c.id = rv.campaign_id
      join public.reports r on r.id = rv.report_id
     where s.id = v_share_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- issue_public_report_print_token
-- After PDF share consume, inserts a one-time report_export_tokens row so the
-- existing print route can load the snapshot without a second share increment.
-- ---------------------------------------------------------------------------

create or replace function public.issue_public_report_print_token(
  p_share_token_hash text,
  p_export_token_hash text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_version_id uuid;
  v_token_id uuid;
begin
  if p_share_token_hash is null
     or p_share_token_hash !~ '^[0-9a-f]{64}$'
     or p_export_token_hash is null
     or p_export_token_hash !~ '^[0-9a-f]{64}$'
     or p_expires_at is null
     or p_expires_at <= timezone('utc', now())
     or p_expires_at > timezone('utc', now()) + interval '5 minutes'
  then
    return null;
  end if;

  select s.report_version_id
    into v_version_id
    from public.public_report_shares s
    join public.report_versions rv on rv.id = s.report_version_id
   where s.token_hash = p_share_token_hash
     and s.allow_pdf_download = true
     and public._public_report_share_is_usable(
           s.revoked_at, s.expires_at, rv.status
         );

  if v_version_id is null then
    return null;
  end if;

  insert into public.report_export_tokens (
    report_version_id,
    token_hash,
    created_by,
    expires_at
  )
  values (
    v_version_id,
    p_export_token_hash,
    null,
    p_expires_at
  )
  returning id into v_token_id;

  return v_token_id;
end;
$$;

revoke all on function public.resolve_public_report_share(text) from public;
revoke all on function public.consume_public_report_share(text, text) from public;
revoke all on function public.consume_public_report_pdf_share(text) from public;
revoke all on function public.issue_public_report_print_token(text, text, timestamptz) from public;
revoke all on function public._public_report_share_is_usable(timestamptz, timestamptz, text) from public;

grant execute on function public.resolve_public_report_share(text) to anon, authenticated;
grant execute on function public.consume_public_report_share(text, text) to anon, authenticated;
grant execute on function public.consume_public_report_pdf_share(text) to anon, authenticated;
grant execute on function public.issue_public_report_print_token(text, text, timestamptz)
  to anon, authenticated;

comment on function public.resolve_public_report_share(text) is
  'Validates a public share token and returns the immutable snapshot without incrementing access_count. Used by SSR / metadata-safe loads.';

comment on function public.consume_public_report_share(text, text) is
  'Records one page access when a fresh 32-hex nonce is supplied; returns snapshot. Never returns token_hash.';

comment on function public.consume_public_report_pdf_share(text) is
  'Validates share, requires allow_pdf_download, increments access_count once per PDF request.';

comment on function public.issue_public_report_print_token(text, text, timestamptz) is
  'Inserts a short-lived report_export_tokens row for public PDF print after share validation.';
