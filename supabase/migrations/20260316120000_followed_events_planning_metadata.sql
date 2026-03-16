alter table if exists public.followed_events
  add column if not exists planned_role_id text references public.roles(id) on update cascade on delete set null,
  add column if not exists planning_status text not null default 'planned',
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'followed_events_planning_status_check'
  ) then
    alter table public.followed_events
      drop constraint followed_events_planning_status_check;
  end if;
end $$;

alter table if exists public.followed_events
  add constraint followed_events_planning_status_check
  check (planning_status in ('planned'));

update public.followed_events fe
set planned_role_id = p.role_id
from public.profiles p
where p.id = fe.user_id
  and fe.planned_role_id is null;

drop trigger if exists set_followed_events_updated_at on public.followed_events;
create trigger set_followed_events_updated_at
before update on public.followed_events
for each row execute function public.set_updated_at();

drop policy if exists "followed events update own" on public.followed_events;
create policy "followed events update own"
on public.followed_events
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
