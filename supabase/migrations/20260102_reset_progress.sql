create or replace function public.reset_my_progress()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  delete from public.turns where user_id = v_user_id;
  delete from public.activity_completions where user_id = v_user_id;
  delete from public.user_badges where user_id = v_user_id;

  update public.profiles
  set
    role_id = 'attore',
    level = 1,
    xp = 0,
    xp_to_next_level = 1000,
    xp_total = 0,
    xp_field = 0,
    reputation = 0,
    cachet = 0
  where id = v_user_id;
end;
$$;

revoke execute on function public.reset_my_progress() from public;
grant execute on function public.reset_my_progress() to authenticated;
