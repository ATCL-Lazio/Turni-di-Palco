-- Issue #329: participation planning schema (event + role + status).
-- Allows users to plan their participation in events with a chosen role.

create type public.participation_status as enum (
  'planned',
  'confirmed',
  'cancelled'
);

create table if not exists public.planned_participations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null references public.events(id) on update cascade on delete cascade,
  role_id text not null references public.roles(id) on update cascade on delete restrict,
  status public.participation_status not null default 'planned',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, event_id)
);

create index if not exists planned_participations_user_idx
  on public.planned_participations (user_id, updated_at desc);

create index if not exists planned_participations_event_idx
  on public.planned_participations (event_id);

drop trigger if exists set_planned_participations_updated_at on public.planned_participations;
create trigger set_planned_participations_updated_at
before update on public.planned_participations
for each row execute function public.set_updated_at();

-- RLS
alter table public.planned_participations enable row level security;
alter table public.planned_participations force row level security;

drop policy if exists "planned participations select own" on public.planned_participations;
create policy "planned participations select own"
on public.planned_participations
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "planned participations insert own" on public.planned_participations;
create policy "planned participations insert own"
on public.planned_participations
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "planned participations update own" on public.planned_participations;
create policy "planned participations update own"
on public.planned_participations
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "planned participations delete own" on public.planned_participations;
create policy "planned participations delete own"
on public.planned_participations
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- RPC: upsert a participation plan (create or update role/status)
create or replace function public.upsert_planned_participation(
  p_event_id text,
  p_role_id text,
  p_status text default 'planned',
  p_notes text default null
)
returns table (
  id uuid,
  event_id text,
  role_id text,
  status public.participation_status,
  notes text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_status public.participation_status;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if trim(coalesce(p_event_id, '')) = '' then
    raise exception 'event_id is required';
  end if;

  if trim(coalesce(p_role_id, '')) = '' then
    raise exception 'role_id is required';
  end if;

  -- Validate event exists
  perform 1 from public.events where events.id = p_event_id;
  if not found then
    raise exception 'event not found';
  end if;

  -- Validate role exists
  perform 1 from public.roles where roles.id = p_role_id;
  if not found then
    raise exception 'invalid role_id';
  end if;

  -- Cast status
  begin
    v_status := p_status::public.participation_status;
  exception when invalid_text_representation then
    raise exception 'invalid status: must be planned, confirmed, or cancelled';
  end;

  insert into public.planned_participations (user_id, event_id, role_id, status, notes)
  values (v_user_id, p_event_id, p_role_id, v_status, p_notes)
  on conflict (user_id, event_id)
  do update set
    role_id = excluded.role_id,
    status = excluded.status,
    notes = excluded.notes;

  return query
  select
    pp.id,
    pp.event_id,
    pp.role_id,
    pp.status,
    pp.notes,
    pp.created_at,
    pp.updated_at
  from public.planned_participations pp
  where pp.user_id = v_user_id
    and pp.event_id = p_event_id;
end;
$$;

revoke execute on function public.upsert_planned_participation(text, text, text, text) from public;
grant execute on function public.upsert_planned_participation(text, text, text, text) to authenticated;

-- RPC: remove a participation plan
create or replace function public.remove_planned_participation(
  p_event_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_deleted integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if trim(coalesce(p_event_id, '')) = '' then
    raise exception 'event_id is required';
  end if;

  delete from public.planned_participations
  where user_id = v_user_id
    and event_id = p_event_id;

  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

revoke execute on function public.remove_planned_participation(text) from public;
grant execute on function public.remove_planned_participation(text) to authenticated;

-- RPC: get all planned participations for current user with event details
create or replace function public.get_my_planned_participations()
returns table (
  id uuid,
  event_id text,
  event_name text,
  theatre text,
  event_date text,
  event_time text,
  role_id text,
  role_name text,
  status public.participation_status,
  notes text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    pp.id,
    pp.event_id,
    e.name as event_name,
    e.theatre,
    e.event_date,
    e.event_time,
    pp.role_id,
    r.name as role_name,
    pp.status,
    pp.notes,
    pp.created_at,
    pp.updated_at
  from public.planned_participations pp
  join public.events e on e.id = pp.event_id
  join public.roles r on r.id = pp.role_id
  where pp.user_id = auth.uid()
  order by pp.updated_at desc;
$$;

revoke execute on function public.get_my_planned_participations() from public;
grant execute on function public.get_my_planned_participations() to authenticated;
