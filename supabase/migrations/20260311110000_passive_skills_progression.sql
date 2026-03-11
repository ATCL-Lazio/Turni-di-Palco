-- Issue #121: passive skills with levels, progression rules, and read RPC.

create table if not exists public.passive_skills (
  id text primary key,
  name text not null,
  description text,
  max_level integer not null default 1 check (max_level >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_passive_skills_updated_at on public.passive_skills;
create trigger set_passive_skills_updated_at
before update on public.passive_skills
for each row execute function public.set_updated_at();

create table if not exists public.passive_skill_levels (
  skill_id text not null references public.passive_skills(id) on update cascade on delete cascade,
  level integer not null check (level >= 1),
  xp_to_next_level integer check (xp_to_next_level > 0),
  modifiers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (skill_id, level)
);

drop trigger if exists set_passive_skill_levels_updated_at on public.passive_skill_levels;
create trigger set_passive_skill_levels_updated_at
before update on public.passive_skill_levels
for each row execute function public.set_updated_at();

create table if not exists public.user_passive_skills (
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_id text not null references public.passive_skills(id) on update cascade on delete cascade,
  level integer not null default 1 check (level >= 1),
  xp integer not null default 0 check (xp >= 0),
  xp_total integer not null default 0 check (xp_total >= 0),
  unlocked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, skill_id)
);

create index if not exists user_passive_skills_user_updated_idx
  on public.user_passive_skills(user_id, updated_at desc);

drop trigger if exists set_user_passive_skills_updated_at on public.user_passive_skills;
create trigger set_user_passive_skills_updated_at
before update on public.user_passive_skills
for each row execute function public.set_updated_at();

create table if not exists public.passive_skill_progress_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_id text not null references public.passive_skills(id) on update cascade on delete restrict,
  source text not null,
  source_ref uuid,
  xp_delta integer not null,
  level_before integer not null,
  level_after integer not null,
  xp_before integer not null,
  xp_after integer not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists passive_skill_progress_log_user_created_idx
  on public.passive_skill_progress_log(user_id, created_at desc);

alter table public.passive_skills enable row level security;
alter table public.passive_skills force row level security;
alter table public.passive_skill_levels enable row level security;
alter table public.passive_skill_levels force row level security;
alter table public.user_passive_skills enable row level security;
alter table public.user_passive_skills force row level security;
alter table public.passive_skill_progress_log enable row level security;
alter table public.passive_skill_progress_log force row level security;

drop policy if exists "passive skills read authenticated" on public.passive_skills;
create policy "passive skills read authenticated"
on public.passive_skills
for select
to authenticated
using (true);

drop policy if exists "passive skill levels read authenticated" on public.passive_skill_levels;
create policy "passive skill levels read authenticated"
on public.passive_skill_levels
for select
to authenticated
using (true);

drop policy if exists "user passive skills select own" on public.user_passive_skills;
create policy "user passive skills select own"
on public.user_passive_skills
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "passive skill progress log select own" on public.passive_skill_progress_log;
create policy "passive skill progress log select own"
on public.passive_skill_progress_log
for select
to authenticated
using (auth.uid() = user_id);

create or replace function public.grant_passive_skill_xp(
  p_skill_id text,
  p_xp_delta integer,
  p_source text default 'manual',
  p_source_ref uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  skill_id text,
  level integer,
  xp integer,
  xp_total integer,
  leveled_up boolean,
  level_gain integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_skill public.passive_skills%rowtype;
  v_user_skill public.user_passive_skills%rowtype;
  v_level_before integer;
  v_xp_before integer;
  v_level_after integer;
  v_xp_after integer;
  v_working_xp integer;
  v_working_level integer;
  v_xp_total_after integer;
  v_threshold integer;
  v_level_gain integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if trim(coalesce(p_skill_id, '')) = '' then
    raise exception 'skill_id is required';
  end if;

  if p_xp_delta = 0 then
    raise exception 'xp_delta must be non-zero';
  end if;

  if trim(coalesce(p_source, '')) = '' then
    raise exception 'source is required';
  end if;

  select *
    into v_skill
  from public.passive_skills
  where id = p_skill_id;

  if not found then
    raise exception 'invalid skill_id';
  end if;

  insert into public.user_passive_skills (user_id, skill_id)
  values (v_user_id, p_skill_id)
  on conflict (user_id, skill_id) do nothing;

  select *
    into v_user_skill
  from public.user_passive_skills
  where user_id = v_user_id
    and skill_id = p_skill_id
  for update;

  v_level_before := v_user_skill.level;
  v_xp_before := v_user_skill.xp;

  v_working_level := v_user_skill.level;
  v_working_xp := greatest(0, v_user_skill.xp + p_xp_delta);
  v_xp_total_after := greatest(0, v_user_skill.xp_total + p_xp_delta);

  loop
    exit when v_working_level >= v_skill.max_level;

    select psl.xp_to_next_level
      into v_threshold
    from public.passive_skill_levels psl
    where psl.skill_id = p_skill_id
      and psl.level = v_working_level;

    if v_threshold is null or v_threshold <= 0 then
      exit;
    end if;

    exit when v_working_xp < v_threshold;

    v_working_xp := v_working_xp - v_threshold;
    v_working_level := v_working_level + 1;
  end loop;

  if v_working_level >= v_skill.max_level then
    v_working_level := v_skill.max_level;
    if p_xp_delta > 0 then
      v_working_xp := 0;
    end if;
  end if;

  update public.user_passive_skills
  set
    level = v_working_level,
    xp = v_working_xp,
    xp_total = v_xp_total_after
  where user_id = v_user_id
    and skill_id = p_skill_id;

  v_level_after := v_working_level;
  v_xp_after := v_working_xp;
  v_level_gain := v_level_after - v_level_before;

  insert into public.passive_skill_progress_log (
    user_id,
    skill_id,
    source,
    source_ref,
    xp_delta,
    level_before,
    level_after,
    xp_before,
    xp_after,
    metadata
  )
  values (
    v_user_id,
    p_skill_id,
    p_source,
    p_source_ref,
    p_xp_delta,
    v_level_before,
    v_level_after,
    v_xp_before,
    v_xp_after,
    coalesce(p_metadata, '{}'::jsonb)
  );

  return query
  select
    p_skill_id,
    v_level_after,
    v_xp_after,
    v_xp_total_after,
    (v_level_gain > 0),
    v_level_gain;
end;
$$;

revoke execute on function public.grant_passive_skill_xp(text, integer, text, uuid, jsonb) from public;
grant execute on function public.grant_passive_skill_xp(text, integer, text, uuid, jsonb) to authenticated;

create or replace function public.get_my_passive_skills()
returns table (
  skill_id text,
  name text,
  description text,
  level integer,
  xp integer,
  xp_total integer,
  max_level integer,
  xp_to_next_level integer,
  progress_ratio numeric
)
language sql
security definer
set search_path = public
as $$
  with resolved as (
    select
      ps.id as skill_id,
      ps.name,
      ps.description,
      ps.max_level,
      coalesce(ups.level, 1) as level,
      coalesce(ups.xp, 0) as xp,
      coalesce(ups.xp_total, 0) as xp_total,
      psl.xp_to_next_level
    from public.passive_skills ps
    left join public.user_passive_skills ups
      on ups.skill_id = ps.id
      and ups.user_id = auth.uid()
    left join public.passive_skill_levels psl
      on psl.skill_id = ps.id
      and psl.level = coalesce(ups.level, 1)
  )
  select
    r.skill_id,
    r.name,
    r.description,
    r.level,
    r.xp,
    r.xp_total,
    r.max_level,
    r.xp_to_next_level,
    case
      when r.xp_to_next_level is null or r.xp_to_next_level <= 0 then 1::numeric
      else least(1::numeric, round(r.xp::numeric / r.xp_to_next_level::numeric, 4))
    end as progress_ratio
  from resolved r
  order by r.skill_id;
$$;

revoke execute on function public.get_my_passive_skills() from public;
grant execute on function public.get_my_passive_skills() to authenticated;

insert into public.passive_skills (id, name, description, max_level)
values
  (
    'cue_precision',
    'Precisione Cue',
    'Migliora la precisione nelle azioni tecniche e riduce l''errore operativo.',
    3
  )
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  max_level = excluded.max_level;

insert into public.passive_skill_levels (skill_id, level, xp_to_next_level, modifiers)
values
  ('cue_precision', 1, 100, '{"timing_window_bonus_ms": 50}'::jsonb),
  ('cue_precision', 2, 250, '{"timing_window_bonus_ms": 120}'::jsonb),
  ('cue_precision', 3, null, '{"timing_window_bonus_ms": 200}'::jsonb)
on conflict (skill_id, level) do update
set
  xp_to_next_level = excluded.xp_to_next_level,
  modifiers = excluded.modifiers;
