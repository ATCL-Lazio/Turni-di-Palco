create or replace function public.register_turn_with_token_boost(
  p_event_id text,
  p_role_id text,
  p_client_action_id uuid,
  p_boost_requested boolean default false,
  p_checkin_latitude double precision default null,
  p_checkin_longitude double precision default null,
  p_checkin_accuracy_m double precision default null
)
returns table (
  turn_registered boolean,
  boost_requested boolean,
  boost_applied boolean,
  boost_rejection_reason text,
  rewards_applied jsonb,
  token_balance_after integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_profile public.profiles%rowtype;
  v_existing_turn public.turns%rowtype;
  v_event record;
  v_bonus integer;
  v_base_xp integer;
  v_base_reputation integer;
  v_base_cachet integer;
  v_final_xp integer;
  v_final_reputation integer;
  v_final_cachet integer;
  v_boost_applied boolean := false;
  v_boost_rejection_reason text := null;
  v_token_working integer;
  v_token_after integer;
  v_turn_token_reward integer := 1;
  v_rewards jsonb;
  v_next_xp integer;
  v_next_level integer;
  v_next_threshold integer;
  v_next_xp_total integer;
  v_next_xp_field integer;
  v_next_reputation integer;
  v_next_cachet integer;
  v_max_distance_m constant double precision := 200;
  v_theatre_table_exists boolean;
  v_name_column text;
  v_lat_column text;
  v_lon_column text;
  v_theatre_lat double precision;
  v_theatre_lon double precision;
  v_distance_m double precision;
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

  if p_client_action_id is null then
    raise exception 'client_action_id is required';
  end if;

  select *
    into v_existing_turn
  from public.turns
  where id = p_client_action_id
    and user_id = v_user_id;

  if found then
    select token_atcl
      into v_token_after
    from public.profiles
    where id = v_user_id;

    return query
    select
      false,
      coalesce(v_existing_turn.boost_requested, false),
      coalesce(v_existing_turn.boost_applied, false),
      v_existing_turn.boost_rejection_reason,
      coalesce(v_existing_turn.rewards, '{}'::jsonb),
      coalesce(v_token_after, 0);
    return;
  end if;

  select *
    into v_profile
  from public.profiles
  where id = v_user_id
  for update;

  if not found then
    raise exception 'profile not found';
  end if;

  perform 1
  from public.roles
  where id = p_role_id;
  if not found then
    raise exception 'invalid role_id';
  end if;

  select
    e.id,
    e.name,
    e.theatre,
    e.event_date,
    e.event_time,
    e.base_rewards,
    e.focus_role
    into v_event
  from public.events e
  where e.id = p_event_id;

  if not found then
    raise exception 'event not found';
  end if;

  if p_checkin_latitude is null or p_checkin_longitude is null then
    raise exception 'geolocation_required';
  end if;

  if p_checkin_latitude < -90 or p_checkin_latitude > 90 then
    raise exception 'invalid_checkin_latitude';
  end if;

  if p_checkin_longitude < -180 or p_checkin_longitude > 180 then
    raise exception 'invalid_checkin_longitude';
  end if;

  select to_regclass('public.theatres') is not null
    into v_theatre_table_exists;

  if not coalesce(v_theatre_table_exists, false) then
    raise exception 'theatres_table_not_found';
  end if;

  select case
    when exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'theatres'
        and column_name = 'name'
    ) then 'name'
    when exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'theatres'
        and column_name = 'theatre'
    ) then 'theatre'
    else null
  end
  into v_name_column;

  select case
    when exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'theatres'
        and column_name = 'latitude'
    ) then 'latitude'
    when exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'theatres'
        and column_name = 'lat'
    ) then 'lat'
    else null
  end
  into v_lat_column;

  select case
    when exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'theatres'
        and column_name = 'longitude'
    ) then 'longitude'
    when exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'theatres'
        and column_name = 'lng'
    ) then 'lng'
    else null
  end
  into v_lon_column;

  if v_name_column is null or v_lat_column is null or v_lon_column is null then
    raise exception 'theatres_geodata_columns_missing';
  end if;

  execute format(
    'select t.%1$I::double precision, t.%2$I::double precision
      from public.theatres t
      where lower(trim(t.%3$I::text)) = lower(trim($1::text))
      limit 1',
    v_lat_column,
    v_lon_column,
    v_name_column
  )
  into v_theatre_lat, v_theatre_lon
  using v_event.theatre;

  if v_theatre_lat is null or v_theatre_lon is null then
    raise exception 'theatre_geofence_not_configured';
  end if;

  v_distance_m := 6371000 * 2 * asin(
    sqrt(
      power(sin(radians((p_checkin_latitude - v_theatre_lat) / 2)), 2)
      + cos(radians(v_theatre_lat))
      * cos(radians(p_checkin_latitude))
      * power(sin(radians((p_checkin_longitude - v_theatre_lon) / 2)), 2)
    )
  );

  if v_distance_m > v_max_distance_m then
    raise exception 'outside_geofence';
  end if;

  v_bonus := case when v_event.focus_role = p_role_id then 15 else 0 end;
  v_base_xp := coalesce((v_event.base_rewards->>'xp')::integer, 0) + v_bonus;
  v_base_cachet := coalesce((v_event.base_rewards->>'cachet')::integer, 0) + round(v_bonus / 2.0)::integer;
  v_base_reputation := coalesce((v_event.base_rewards->>'reputation')::integer, 0) + round(v_bonus / 3.0)::integer;

  v_final_xp := v_base_xp;
  v_final_cachet := v_base_cachet;
  v_final_reputation := v_base_reputation;
  v_token_working := coalesce(v_profile.token_atcl, 0);

  if p_boost_requested then
    if v_token_working >= 1 then
      v_boost_applied := true;
      v_token_working := v_token_working - 1;
      v_final_xp := ceil(v_base_xp * 1.10)::integer;
      v_final_cachet := ceil(v_base_cachet * 1.10)::integer;

      insert into public.token_ledger (
        user_id,
        reason,
        delta,
        balance_after,
        metadata
      )
      values (
        v_user_id,
        'spend_boost',
        -1,
        v_token_working,
        jsonb_build_object(
          'event_id', v_event.id,
          'turn_id', p_client_action_id,
          'client_action_id', p_client_action_id
        )
      );
    else
      v_boost_applied := false;
      v_boost_rejection_reason := 'insufficient_token_balance';
    end if;
  end if;

  v_rewards := jsonb_build_object(
    'xp', v_final_xp,
    'reputation', v_final_reputation,
    'cachet', v_final_cachet
  );

  insert into public.turns (
    id,
    user_id,
    event_id,
    event_name,
    theatre,
    event_date,
    event_time,
    role_id,
    rewards,
    boost_requested,
    boost_applied,
    boost_rejection_reason
  )
  values (
    p_client_action_id,
    v_user_id,
    v_event.id,
    v_event.name,
    v_event.theatre,
    v_event.event_date,
    v_event.event_time,
    p_role_id,
    v_rewards,
    p_boost_requested,
    v_boost_applied,
    v_boost_rejection_reason
  );

  v_next_xp := coalesce(v_profile.xp, 0) + v_final_xp;
  v_next_level := coalesce(v_profile.level, 1);
  v_next_threshold := greatest(1, coalesce(v_profile.xp_to_next_level, 1000));
  while v_next_xp >= v_next_threshold loop
    v_next_xp := v_next_xp - v_next_threshold;
    v_next_level := v_next_level + 1;
    v_next_threshold := 1000 + v_next_level * 250;
  end loop;

  v_next_xp_total := coalesce(v_profile.xp_total, 0) + v_final_xp;
  v_next_xp_field := coalesce(v_profile.xp_field, 0) + v_final_xp;
  v_next_reputation := least(100, coalesce(v_profile.reputation, 0) + v_final_reputation);
  v_next_cachet := coalesce(v_profile.cachet, 0) + v_final_cachet;
  v_token_after := v_token_working + v_turn_token_reward;

  update public.profiles
  set
    level = v_next_level,
    xp = v_next_xp,
    xp_to_next_level = v_next_threshold,
    xp_total = v_next_xp_total,
    xp_field = v_next_xp_field,
    reputation = v_next_reputation,
    cachet = v_next_cachet,
    token_atcl = v_token_after,
    last_activity_at = now()
  where id = v_user_id;

  insert into public.token_ledger (
    user_id,
    reason,
    delta,
    balance_after,
    metadata
  )
  values (
    v_user_id,
    'earn_turn',
    v_turn_token_reward,
    v_token_after,
    jsonb_build_object(
      'event_id', v_event.id,
      'turn_id', p_client_action_id,
      'client_action_id', p_client_action_id,
      'boost_requested', p_boost_requested,
      'boost_applied', v_boost_applied,
      'rewards', v_rewards
    )
  );

  return query
  select
    true,
    p_boost_requested,
    v_boost_applied,
    v_boost_rejection_reason,
    v_rewards,
    v_token_after;
exception
  when unique_violation then
    select *
      into v_existing_turn
    from public.turns
    where id = p_client_action_id
      and user_id = v_user_id;
    if found then
      select token_atcl
        into v_token_after
      from public.profiles
      where id = v_user_id;

      return query
      select
        false,
        coalesce(v_existing_turn.boost_requested, false),
        coalesce(v_existing_turn.boost_applied, false),
        v_existing_turn.boost_rejection_reason,
        coalesce(v_existing_turn.rewards, '{}'::jsonb),
        coalesce(v_token_after, 0);
      return;
    end if;
    raise;
end;
$$;

revoke execute on function public.register_turn_with_token_boost(text, text, uuid, boolean, double precision, double precision, double precision) from public;
grant execute on function public.register_turn_with_token_boost(text, text, uuid, boolean, double precision, double precision, double precision) to authenticated;
