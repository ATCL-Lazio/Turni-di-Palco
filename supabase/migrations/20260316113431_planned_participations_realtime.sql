-- PR #373: add planned_participations to supabase_realtime publication.
-- Depends on planned_participations existing (created/renamed by 20260316113430).

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'planned_participations'
    ) then
      alter publication supabase_realtime add table public.planned_participations;
    end if;
  end if;
end;
$$;
