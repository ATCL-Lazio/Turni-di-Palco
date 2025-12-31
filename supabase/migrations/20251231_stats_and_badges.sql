create table if not exists public.badges (
  id text primary key,
  title text not null,
  description text,
  icon text not null default 'Award',
  metric text,
  threshold integer,
  created_at timestamptz not null default now(),
  constraint badges_metric_check check (
    metric is null
    or metric in ('total_turns', 'turns_this_month', 'unique_theatres', 'manual')
  )
);

create table if not exists public.user_badges (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_id text not null references public.badges(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  seen_at timestamptz,
  primary key (user_id, badge_id)
);

create index if not exists user_badges_user_id_idx on public.user_badges(user_id);

alter table public.badges enable row level security;
alter table public.user_badges enable row level security;

create policy "badges read" on public.badges
for select using (true);

create policy "user badges select own" on public.user_badges
for select using (auth.uid() = user_id);

create policy "user badges update own" on public.user_badges
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace view public.my_turn_stats as
select
  auth.uid() as user_id,
  (select count(*)::int from public.turns t where t.user_id = auth.uid()) as total_turns,
  (
    select count(*)::int
    from public.turns t
    where t.user_id = auth.uid()
      and t.created_at >= date_trunc('month', now())
      and t.created_at < (date_trunc('month', now()) + interval '1 month')
  ) as turns_this_month,
  (
    select count(distinct t.theatre)::int
    from public.turns t
    where t.user_id = auth.uid()
      and t.theatre is not null
      and t.theatre <> ''
  ) as unique_theatres;

create or replace view public.my_badges as
select
  b.id,
  b.title,
  b.description,
  b.icon,
  b.metric,
  b.threshold,
  ub.unlocked_at,
  ub.seen_at,
  (ub.badge_id is not null) as unlocked
from public.badges b
left join public.user_badges ub
  on ub.badge_id = b.id and ub.user_id = auth.uid();

grant select on public.badges to anon, authenticated;
grant select on public.user_badges to authenticated;
grant select on public.my_turn_stats to authenticated;
grant select on public.my_badges to authenticated;

create or replace function public.evaluate_badges_for_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_turns integer;
  v_turns_this_month integer;
  v_unique_theatres integer;
begin
  if p_user_id is null then
    return;
  end if;

  select count(*)::int
    into v_total_turns
  from public.turns
  where user_id = p_user_id;

  select count(*)::int
    into v_turns_this_month
  from public.turns
  where user_id = p_user_id
    and created_at >= date_trunc('month', now())
    and created_at < (date_trunc('month', now()) + interval '1 month');

  select count(distinct theatre)::int
    into v_unique_theatres
  from public.turns
  where user_id = p_user_id
    and theatre is not null
    and theatre <> '';

  insert into public.user_badges (user_id, badge_id)
  select p_user_id, b.id
  from public.badges b
  where b.metric = 'total_turns'
    and b.threshold is not null
    and v_total_turns >= b.threshold
  on conflict do nothing;

  insert into public.user_badges (user_id, badge_id)
  select p_user_id, b.id
  from public.badges b
  where b.metric = 'turns_this_month'
    and b.threshold is not null
    and v_turns_this_month >= b.threshold
  on conflict do nothing;

  insert into public.user_badges (user_id, badge_id)
  select p_user_id, b.id
  from public.badges b
  where b.metric = 'unique_theatres'
    and b.threshold is not null
    and v_unique_theatres >= b.threshold
  on conflict do nothing;
end;
$$;

revoke execute on function public.evaluate_badges_for_user(uuid) from public;

create or replace function public.evaluate_my_badges()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  perform public.evaluate_badges_for_user(auth.uid());
end;
$$;

revoke execute on function public.evaluate_my_badges() from public;
grant execute on function public.evaluate_my_badges() to authenticated;

create or replace function public.mark_my_badges_seen()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_updated int;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  update public.user_badges
    set seen_at = now()
  where user_id = v_user_id and seen_at is null;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke execute on function public.mark_my_badges_seen() from public;
grant execute on function public.mark_my_badges_seen() to authenticated;

create or replace function public.award_badges_on_turn_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.evaluate_badges_for_user(new.user_id);
  return new;
end;
$$;

drop trigger if exists turns_award_badges on public.turns;
create trigger turns_award_badges
after insert on public.turns
for each row execute function public.award_badges_on_turn_insert();

insert into public.badges (id, title, description, icon, metric, threshold)
values
  ('unique_theatres_3', 'Ha lavorato in 3 teatri diversi', null, 'MapPin', 'unique_theatres', 3),
  ('first_season', 'Prima stagione completata', null, 'Award', 'manual', null),
  ('total_turns_10', '10 turni registrati', null, 'Theater', 'total_turns', 10)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  icon = excluded.icon,
  metric = excluded.metric,
  threshold = excluded.threshold;
