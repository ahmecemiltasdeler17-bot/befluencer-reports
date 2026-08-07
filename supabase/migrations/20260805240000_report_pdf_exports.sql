-- BeFluencer Reports — one-time PDF export tokens
--
-- PDF export renders an immutable report_versions snapshot inside a headless
-- browser. That browser has no Supabase session cookie, so it authenticates the
-- internal print route with a single-use, short-lived capability token instead
-- of a service-role key.
--
-- Only the SHA-256 hash of the token is stored. The raw token exists in memory
-- and in the print URL for at most a few seconds and is never logged.

-- ---------------------------------------------------------------------------
-- report_export_tokens
-- ---------------------------------------------------------------------------

create table if not exists public.report_export_tokens (
  id uuid primary key default gen_random_uuid(),
  report_version_id uuid not null references public.report_versions (id) on delete cascade,
  token_hash text not null unique,
  created_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint report_export_tokens_hash_is_sha256 check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint report_export_tokens_expires_after_creation check (expires_at > created_at),
  constraint report_export_tokens_lifetime_max check (
    expires_at <= created_at + interval '5 minutes'
  )
);

comment on table public.report_export_tokens is
  'Single-use, max 5 minute tokens allowing the PDF print route to load one immutable report version.';

comment on column public.report_export_tokens.token_hash is
  'SHA-256 hex digest of the raw token. The raw token is never stored.';

comment on column public.report_export_tokens.used_at is
  'Set by consume_report_export_token(). A non-null value permanently invalidates the token.';

create index if not exists report_export_tokens_report_version_id_idx
  on public.report_export_tokens (report_version_id);

create index if not exists report_export_tokens_expires_at_idx
  on public.report_export_tokens (expires_at);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.report_export_tokens enable row level security;

revoke all on public.report_export_tokens from anon;

-- No update grant: single-use marking happens only inside the security definer
-- function below, so a client can never reset used_at.
grant select, insert on public.report_export_tokens to authenticated;

drop policy if exists report_export_tokens_authenticated_select on public.report_export_tokens;
drop policy if exists report_export_tokens_authenticated_insert on public.report_export_tokens;

create policy report_export_tokens_authenticated_select
  on public.report_export_tokens
  for select
  to authenticated
  using (created_by = auth.uid());

create policy report_export_tokens_authenticated_insert
  on public.report_export_tokens
  for insert
  to authenticated
  with check (created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- Token consumption
--
-- Atomically claims an unexpired, unused token and returns the immutable
-- snapshot for that version. Runs as security definer so the headless browser
-- (anon role) can read exactly one snapshot it holds a valid token for, without
-- any table privileges and without a service-role key.
-- ---------------------------------------------------------------------------

create or replace function public.consume_report_export_token(p_token_hash text)
returns table (
  report_version_id uuid,
  campaign_id uuid,
  version_number integer,
  status text,
  generated_at timestamptz,
  source_last_synced_at timestamptz,
  snapshot jsonb,
  campaign_name text,
  report_number text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_token_id uuid;
  v_version_id uuid;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  update public.report_export_tokens t
     set used_at = timezone('utc', now())
   where t.token_hash = p_token_hash
     and t.used_at is null
     and t.expires_at > timezone('utc', now())
  returning t.id, t.report_version_id
       into v_token_id, v_version_id;

  if v_token_id is null then
    return;
  end if;

  return query
    select rv.id,
           rv.campaign_id,
           rv.version_number,
           rv.status,
           rv.generated_at,
           rv.source_last_synced_at,
           rv.snapshot,
           c.name,
           coalesce(r.report_number, c.report_number)
      from public.report_versions rv
      join public.campaigns c on c.id = rv.campaign_id
      left join public.reports r on r.id = rv.report_id
     where rv.id = v_version_id
       and rv.status in ('ready', 'archived');
end;
$$;

comment on function public.consume_report_export_token(text) is
  'Claims a single-use export token and returns the matching ready/archived report snapshot.';

revoke all on function public.consume_report_export_token(text) from public;
grant execute on function public.consume_report_export_token(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Expired token cleanup helper (manual or future scheduled invocation)
-- ---------------------------------------------------------------------------

create or replace function public.purge_expired_report_export_tokens()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted integer;
begin
  delete from public.report_export_tokens
   where expires_at < timezone('utc', now()) - interval '1 day';

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

comment on function public.purge_expired_report_export_tokens() is
  'Deletes export tokens that expired more than a day ago.';

revoke all on function public.purge_expired_report_export_tokens() from public;
grant execute on function public.purge_expired_report_export_tokens() to authenticated;
