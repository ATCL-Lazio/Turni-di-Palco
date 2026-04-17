create or replace view public.my_theatre_reputation as
select
  t.theatre,
  least(sum(coalesce((t.rewards->>'reputation')::int, 0)), 100)::int as reputation,
  count(*)::int as total_turns
from public.turns t
where t.user_id = auth.uid()
  and t.theatre is not null
  and t.theatre <> ''
group by t.theatre;

grant select on public.my_theatre_reputation to authenticated;

