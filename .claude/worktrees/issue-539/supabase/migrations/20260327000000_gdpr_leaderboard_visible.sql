-- GDPR Art. 21 – Diritto di opposizione: aggiunge il campo leaderboard_visible a profiles.
-- Se false, il profilo non compare nella classifica pubblica restituita da get_leaderboard().

alter table public.profiles
  add column if not exists leaderboard_visible boolean not null default true;

-- Aggiorna get_leaderboard per rispettare la preferenza dell'utente.
create or replace function public.get_leaderboard(p_limit int default 50)
returns table (
  id uuid,
  name text,
  role_id text,
  xp_total int,
  cachet int,
  reputation int,
  profile_image text,
  last_activity_at timestamptz,
  turns_count int
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.name,
    p.role_id,
    p.xp_total,
    p.cachet,
    p.reputation,
    p.profile_image,
    p.last_activity_at,
    (
      select count(*)::int
      from public.turns t
      where t.user_id = p.id
    ) as turns_count
  from public.profiles p
  where p.leaderboard_visible = true
  order by p.xp_total desc nulls last
  limit greatest(1, least(p_limit, 200));
$$;

revoke execute on function public.get_leaderboard(int) from public;
grant execute on function public.get_leaderboard(int) to authenticated;
