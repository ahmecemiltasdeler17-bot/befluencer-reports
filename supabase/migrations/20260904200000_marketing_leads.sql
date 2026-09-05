-- Marketing site form submissions land in the management app.
--
-- befluencer-web posts brand inquiries and creator applications to
-- POST /api/public/leads with a shared secret. That route validates the secret
-- and the payload, then writes through the security-definer function below —
-- the marketing site never holds a database credential and `anon` never gets a
-- table privilege, matching how every other public write in this schema works.
--
-- A creator application is NOT turned into a creator row here. An admin decides
-- that explicitly, the same rule unmatched campaign submissions follow: no
-- creator record appears from an unverified form.

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('brand_inquiry', 'creator_application')),
  status text not null default 'new'
    check (status in ('new', 'contacted', 'qualified', 'archived')),
  full_name text not null,
  email text not null,
  phone text,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  admin_note text,
  creator_id uuid references public.creators (id) on delete set null,
  submitted_at timestamptz,
  received_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger leads_set_updated_at before update on public.leads
for each row execute function public.set_updated_at();

create index leads_status_received_idx on public.leads (status, received_at desc);
create index leads_kind_received_idx on public.leads (kind, received_at desc);
create index leads_creator_id_idx on public.leads (creator_id)
  where creator_id is not null;

comment on table public.leads is
  'Inbound marketing-site form submissions. payload holds the raw submitted fields; full_name/email/phone are extracted for listing and search.';
comment on column public.leads.payload is
  'Raw form fields as submitted, minus consent and honeypot. Never rewritten after ingest.';
comment on column public.leads.creator_id is
  'Set only when an admin explicitly converts a creator application into a creator record.';
comment on column public.leads.submitted_at is
  'Timestamp reported by the marketing site. received_at is when this app stored it.';

alter table public.leads enable row level security;

revoke all on public.leads from anon;
grant select, insert, update, delete on public.leads to authenticated;

create policy leads_authenticated_all on public.leads
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Public ingest
-- ---------------------------------------------------------------------------

create or replace function public.create_marketing_lead(
  p_kind text,
  p_full_name text,
  p_email text,
  p_phone text,
  p_payload jsonb,
  p_submitted_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_kind is null or p_kind not in ('brand_inquiry', 'creator_application') then
    raise exception 'invalid_lead_kind';
  end if;

  if coalesce(btrim(p_full_name), '') = '' or coalesce(btrim(p_email), '') = '' then
    raise exception 'invalid_lead_identity';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid_lead_payload';
  end if;

  insert into public.leads (kind, full_name, email, phone, payload, submitted_at)
  values (
    p_kind,
    left(btrim(p_full_name), 200),
    lower(left(btrim(p_email), 320)),
    nullif(left(btrim(coalesce(p_phone, '')), 50), ''),
    p_payload,
    coalesce(p_submitted_at, timezone('utc', now()))
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.create_marketing_lead(text, text, text, text, jsonb, timestamptz) is
  'Sole write path for marketing-site form submissions. Security definer so anon needs no table privilege; the calling API route authenticates the marketing site with a shared secret.';

revoke all on function public.create_marketing_lead(text, text, text, text, jsonb, timestamptz) from public;
grant execute on function public.create_marketing_lead(text, text, text, text, jsonb, timestamptz) to anon, authenticated;
