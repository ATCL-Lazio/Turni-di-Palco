-- Ensure planned_participations is replicated over Supabase Realtime after the
-- rename/backfill migration has run on older environments.

do $$
begin
  if to_regclass('public.planned_participations') is null then
    return;
  end if;

  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'planned_participations'
    ) then
      alter publication supabase_realtime add table public.planned_participations;
    end if;
  end if;
end;
$$;
