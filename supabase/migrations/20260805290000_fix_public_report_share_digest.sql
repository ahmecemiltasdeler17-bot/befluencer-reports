-- Fix public share resolve/consume: digest() lives in extensions on Supabase.
-- Phase 13 RPCs used search_path = public, pg_temp, so anon resolve failed with
-- SQLSTATE 42883 (function digest(text, unknown) does not exist) and every
-- public link rendered as unavailable despite a valid share row.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- resolve_public_report_share
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
set search_path = public, extensions, pg_temp
as $$
declare
  v_hash text;
begin
  if p_raw_token is null or p_raw_token !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  -- Match Node: createHash('sha256').update(rawToken, 'utf8').digest('hex')
  v_hash := encode(
    extensions.digest(convert_to(p_raw_token, 'UTF8'), 'sha256'),
    'hex'
  );

  return query
    select s.id as share_id,
           rv.id as report_version_id,
           rv.campaign_id as campaign_id,
           rv.version_number as version_number,
           rv.status as status,
           rv.generated_at as generated_at,
           rv.snapshot as snapshot,
           c.name as campaign_name,
           coalesce(c.report_number, r.report_number) as report_number,
           s.allow_pdf_download as allow_pdf_download,
           s.expires_at as expires_at,
           s.label as label
      from public.public_report_shares s
      join public.report_versions rv on rv.id = s.report_version_id
      join public.campaigns c on c.id = rv.campaign_id
      left join public.reports r on r.id = rv.report_id
     where s.token_hash = v_hash
       and public._public_report_share_is_usable(
             s.revoked_at, s.expires_at, rv.status
           );
end;
$$;

-- ---------------------------------------------------------------------------
-- consume_public_report_share
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
set search_path = public, extensions, pg_temp
as $$
declare
  v_hash text;
  v_share_id uuid;
  v_recorded boolean := false;
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
    from public.public_report_shares s
    join public.report_versions rv on rv.id = s.report_version_id
   where s.token_hash = v_hash
     and public._public_report_share_is_usable(
           s.revoked_at, s.expires_at, rv.status
         );

  if v_share_id is null then
    return;
  end if;

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
    select s.id as share_id,
           rv.id as report_version_id,
           rv.campaign_id as campaign_id,
           rv.version_number as version_number,
           rv.status as status,
           rv.generated_at as generated_at,
           rv.snapshot as snapshot,
           c.name as campaign_name,
           coalesce(c.report_number, r.report_number) as report_number,
           s.allow_pdf_download as allow_pdf_download,
           s.expires_at as expires_at,
           s.label as label,
           v_recorded as access_recorded
      from public.public_report_shares s
      join public.report_versions rv on rv.id = s.report_version_id
      join public.campaigns c on c.id = rv.campaign_id
      left join public.reports r on r.id = rv.report_id
     where s.id = v_share_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- consume_public_report_pdf_share
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
set search_path = public, extensions, pg_temp
as $$
declare
  v_hash text;
  v_share_id uuid;
begin
  if p_raw_token is null or p_raw_token !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  v_hash := encode(
    extensions.digest(convert_to(p_raw_token, 'UTF8'), 'sha256'),
    'hex'
  );

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
    select s.id as share_id,
           rv.id as report_version_id,
           rv.campaign_id as campaign_id,
           rv.version_number as version_number,
           rv.status as status,
           rv.generated_at as generated_at,
           rv.snapshot as snapshot,
           c.name as campaign_name,
           coalesce(c.report_number, r.report_number) as report_number,
           s.allow_pdf_download as allow_pdf_download
      from public.public_report_shares s
      join public.report_versions rv on rv.id = s.report_version_id
      join public.campaigns c on c.id = rv.campaign_id
      left join public.reports r on r.id = rv.report_id
     where s.id = v_share_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- issue_public_report_print_token (search_path only; no digest)
-- ---------------------------------------------------------------------------

create or replace function public.issue_public_report_print_token(
  p_share_token_hash text,
  p_export_token_hash text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
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

grant execute on function public.resolve_public_report_share(text) to anon, authenticated;
grant execute on function public.consume_public_report_share(text, text) to anon, authenticated;
grant execute on function public.consume_public_report_pdf_share(text) to anon, authenticated;
grant execute on function public.issue_public_report_print_token(text, text, timestamptz)
  to anon, authenticated;
