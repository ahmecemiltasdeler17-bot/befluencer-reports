-- Run in Supabase SQL Editor to inspect production FK behavior for videos.creator_id.

select
  c.conname as constraint_name,
  pg_get_constraintdef(c.oid) as definition,
  case
    when pg_get_constraintdef(c.oid) ilike '%on delete cascade%' then 'CASCADE'
    when pg_get_constraintdef(c.oid) ilike '%on delete set null%' then 'SET NULL'
    when pg_get_constraintdef(c.oid) ilike '%on delete set default%' then 'SET DEFAULT'
    when pg_get_constraintdef(c.oid) ilike '%on delete restrict%' then 'RESTRICT'
    when pg_get_constraintdef(c.oid) ilike '%on delete no action%' then 'NO ACTION'
    when pg_get_constraintdef(c.oid) not ilike '%on delete%' then 'NO ACTION (default)'
    else 'UNKNOWN'
  end as on_delete_action
from pg_constraint c
join pg_class rel on rel.oid = c.conrelid
join pg_namespace nsp on nsp.oid = rel.relnamespace
where nsp.nspname = 'public'
  and rel.relname = 'videos'
  and c.contype = 'f'
  and pg_get_constraintdef(c.oid) ilike '%creator_id%';

-- Column nullability
select
  column_name,
  is_nullable,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'videos'
  and column_name = 'creator_id';

-- Any trigger that might rewrite creator_id on creator delete
select
  tgname as trigger_name,
  pg_get_triggerdef(t.oid) as definition
from pg_trigger t
join pg_class rel on rel.oid = t.tgrelid
join pg_namespace nsp on nsp.oid = rel.relnamespace
where nsp.nspname = 'public'
  and rel.relname in ('videos', 'creators')
  and not t.tgisinternal
  and (
    pg_get_triggerdef(t.oid) ilike '%creator_id%'
    or pg_get_triggerdef(t.oid) ilike '%delete%'
  );
