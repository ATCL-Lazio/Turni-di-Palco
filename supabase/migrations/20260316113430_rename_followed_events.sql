-- Issue #330 follow-up: rename followed_events → planned_participations.
-- Idempotent: only acts when followed_events exists and planned_participations does not.

do $$
begin
  -- Case 1: followed_events exists, planned_participations does not → rename + backfill schema.
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'followed_events'
  ) and not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'planned_participations'
  ) then

    alter table public.followed_events rename to planned_participations;

    -- Add columns introduced by the richer planning schema if they are missing.
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'planned_participations' and column_name = 'id'
    ) then
      alter table public.planned_participations
        add column id uuid not null default gen_random_uuid();
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'planned_participations' and column_name = 'role_id'
    ) then
      alter table public.planned_participations
        add column role_id text references public.roles(id) on update cascade on delete restrict;
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'planned_participations' and column_name = 'status'
    ) then
      -- Ensure the enum type exists before using it.
      if not exists (select 1 from pg_type where typname = 'participation_status') then
        create type public.participation_status as enum ('planned', 'confirmed', 'cancelled');
      end if;
      alter table public.planned_participations
        add column status public.participation_status not null default 'planned';
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'planned_participations' and column_name = 'notes'
    ) then
      alter table public.planned_participations add column notes text;
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'planned_participations' and column_name = 'created_at'
    ) then
      alter table public.planned_participations
        add column created_at timestamptz not null default now();
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'planned_participations' and column_name = 'updated_at'
    ) then
      alter table public.planned_participations
        add column updated_at timestamptz not null default now();
    end if;

    -- Rename legacy RLS policies to match the new table name.
    if exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'planned_participations'
        and policyname = 'followed events select own'
    ) then
      alter policy "followed events select own"
        on public.planned_participations
        rename to "planned participations select own";
    end if;

    if exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'planned_participations'
        and policyname = 'followed events insert own'
    ) then
      alter policy "followed events insert own"
        on public.planned_participations
        rename to "planned participations insert own";
    end if;

    if exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'planned_participations'
        and policyname = 'followed events delete own'
    ) then
      alter policy "followed events delete own"
        on public.planned_participations
        rename to "planned participations delete own";
    end if;

    raise notice 'followed_events renamed to planned_participations';

  -- Case 2: both tables exist → drop the legacy one (data already in planned_participations).
  elsif exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'followed_events'
  ) and exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'planned_participations'
  ) then
    drop table public.followed_events;
    raise notice 'followed_events dropped (planned_participations already existed)';

  else
    raise notice 'planned_participations already exists, nothing to do';
  end if;
end;
$$;
