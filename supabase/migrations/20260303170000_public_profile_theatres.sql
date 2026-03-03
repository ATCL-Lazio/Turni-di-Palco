create or replace function public.get_public_profile_theatres(p_user_id uuid)
returns table (
  theatre text,
  turns_count int,
  last_turn_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    btrim(t.theatre) as theatre,
    count(*)::int as turns_count,
    max(t.created_at) as last_turn_at
  from public.turns t
  where t.user_id = p_user_id
    and nullif(btrim(coalesce(t.theatre, '')), '') is not null
  group by btrim(t.theatre)
  order by max(t.created_at) desc, count(*) desc, btrim(t.theatre) asc;
$$;

revoke execute on function public.get_public_profile_theatres(uuid) from public;
grant execute on function public.get_public_profile_theatres(uuid) to authenticated;
