alter table public.badges
  add column if not exists is_hidden boolean not null default false;

drop view if exists public.my_badges;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'badges'
      and column_name = 'visibility'
  ) then
    update public.badges
    set is_hidden = (visibility = 'hidden');

    alter table public.badges
      drop constraint if exists badges_visibility_check;

    alter table public.badges
      drop column visibility;
  end if;
end;
$$;

update public.badges
set is_hidden = false
where id in (
  'first_turn',
  'turns_this_month_3',
  'unique_theatres_3',
  'total_turns_10',
  'unique_theatres_5'
);

update public.badges
set is_hidden = true
where id in (
  'turns_this_month_6',
  'total_turns_25',
  'unique_theatres_8'
);

create view public.my_badges as
select
  b.id,
  b.title,
  b.description,
  b.icon,
  b.metric,
  b.threshold,
  b.is_hidden,
  ub.unlocked_at,
  ub.seen_at,
  (ub.badge_id is not null) as unlocked
from public.badges b
left join public.user_badges ub
  on ub.badge_id = b.id and ub.user_id = auth.uid();

grant select on public.my_badges to authenticated;
