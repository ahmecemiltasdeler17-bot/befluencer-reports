-- Defense in depth: videos.creator_id must block creator hard-deletes.
-- Repo initial schema already declares ON DELETE RESTRICT; production may drift
-- (missing FK / CASCADE). This migration recreates the FK as RESTRICT without
-- rewriting or deleting video rows.

do $$
declare
  existing_name text;
  existing_def text;
begin
  select c.conname, pg_get_constraintdef(c.oid)
    into existing_name, existing_def
  from pg_constraint c
  join pg_class rel on rel.oid = c.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'videos'
    and c.contype = 'f'
    and pg_get_constraintdef(c.oid) ilike '%creator_id%creators%';

  if existing_name is not null
     and existing_def ilike '%on delete restrict%' then
    -- Already correct.
    return;
  end if;

  if existing_name is not null then
    execute format('alter table public.videos drop constraint %I', existing_name);
  end if;

  alter table public.videos
    add constraint videos_creator_id_fkey
    foreign key (creator_id)
    references public.creators (id)
    on delete restrict;

  comment on constraint videos_creator_id_fkey on public.videos is
    'Creator hard-delete is blocked while any video references the creator.';
end $$;
