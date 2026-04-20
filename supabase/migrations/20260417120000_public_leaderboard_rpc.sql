-- Public leaderboard RPC: anonymous-callable projection of the internal
-- leaderboard, limited to non-sensitive columns and to users who have not
-- opted out via GDPR Art. 21 (leaderboard_visible).

create or replace function public.get_public_leaderboard(p_limit int default 50)
returns table (
  rank int,
  name text,
  role_id text,
  xp_total int,
  reputation int,
  profile_image text,
  turns_count int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (row_number() over (order by p.xp_total desc nulls last))::int as rank,
    p.name,
    p.role_id,
    p.xp_total,
    p.reputation,
    p.profile_image,
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

revoke execute on function public.get_public_leaderboard(int) from public;
grant execute on function public.get_public_leaderboard(int) to anon, authenticated;
