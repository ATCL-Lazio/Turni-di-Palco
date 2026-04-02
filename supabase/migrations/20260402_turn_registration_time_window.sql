-- Add temporal window validation to turn registration (issue #325)
-- A turn can only be registered if the event has not ended more than 24 hours ago.
-- event_time NULL is treated as end-of-day (23:59:59).

CREATE OR REPLACE FUNCTION public.register_turn_with_token_boost(
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
  boost_applied boolean,
  boost_requested boolean,
  boost_rejection_reason text,
  rewards_applied jsonb,
  token_balance_after integer,
  geofence_validated boolean,
  geofence_distance_m double precision,
  error_code text,
  error_message text
)
language plpgsql
security definer
as $$
declare
  v_event_exists boolean;
  v_event_date date;
  v_event_time time;
  v_event_datetime timestamptz;
  v_user_id uuid;
  v_existing_turn_id uuid;
  v_current_token_balance integer;
  v_boost_cost integer = 1;
  v_base_rewards jsonb;
  v_final_rewards jsonb;
  v_theatre_lat double precision;
  v_theatre_lon double precision;
  v_theatre_radius_m double precision;
  v_theatre_table_exists boolean;
  v_geofence_enabled boolean;
  v_mobile_feature_flags_table_exists boolean;
  v_distance_m double precision;
  v_geofence_validated boolean = false;
  v_error_code text;
  v_error_message text;
begin
  -- Check if event exists and get its date/time
  select exists(select 1 from public.events where id = p_event_id)
    into v_event_exists;

  if not v_event_exists then
    raise exception 'event_not_found';
  end if;

  select event_date, event_time
    into v_event_date, v_event_time
    from public.events
    where id = p_event_id;

  -- Temporal window check: reject if event ended more than 24 hours ago.
  -- When event_time is NULL fall back to end-of-day (23:59:59).
  v_event_datetime := (v_event_date::timestamp
    + coalesce(v_event_time, time '23:59:59')) at time zone 'UTC';

  if v_event_datetime < (now() - interval '24 hours') then
    raise exception 'registration_window_expired';
  end if;

  -- Get authenticated user ID from JWT context
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'user_not_authenticated';
  end if;

  -- Check for existing turn registration
  select id
    into v_existing_turn_id
    from public.turns
    where user_id = v_user_id
      and event_id = p_event_id
      and deleted_at is null
    limit 1;

  if v_existing_turn_id is not null then
    return query
    select
      false as turn_registered,
      false as boost_applied,
      p_boost_requested as boost_requested,
      'already_registered' as boost_rejection_reason,
      '{}'::jsonb as rewards_applied,
      0 as token_balance_after,
      false as geofence_validated,
      null::double precision as geofence_distance_m,
      'already_registered' as error_code,
      'Hai già registrato un turno per questo evento.' as error_message;
    return;
  end if;

  -- Get current token balance
  select coalesce(token_atcl, 0)
    into v_current_token_balance
    from public.profiles
    where id = v_user_id;

  -- Handle boost request
  if p_boost_requested then
    if v_current_token_balance >= v_boost_cost then
      update public.profiles
        set token_atcl = token_atcl - v_boost_cost
        where id = v_user_id;
      v_current_token_balance := v_current_token_balance - v_boost_cost;
    else
      return query
      select
        false as turn_registered,
        false as boost_applied,
        p_boost_requested as boost_requested,
        'insufficient_token_balance' as boost_rejection_reason,
        '{}'::jsonb as rewards_applied,
        v_current_token_balance as token_balance_after,
        false as geofence_validated,
        null::double precision as geofence_distance_m,
        'insufficient_tokens' as error_code,
        'Token ATCL insufficienti per richiedere il boost.' as error_message;
      return;
    end if;
  end if;

  -- Check if geofence validation is enabled
  select exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'mobile_feature_flags')
    into v_mobile_feature_flags_table_exists;

  if coalesce(v_mobile_feature_flags_table_exists, false) then
    select enabled
      into v_geofence_enabled
    from public.mobile_feature_flags
    where key = 'mobile.action.turn_geofence'
    limit 1;
    v_geofence_enabled := coalesce(v_geofence_enabled, true);
  else
    v_geofence_enabled := true;
  end if;

  -- Perform geofence validation only if coordinates are provided and geofence is enabled
  v_geofence_validated := true;
  v_distance_m := null;

  if v_geofence_enabled and p_checkin_latitude is not null and p_checkin_longitude is not null then
    if p_checkin_latitude < -90 or p_checkin_latitude > 90 then
      v_error_code := 'invalid_checkin_latitude';
      v_error_message := 'Coordinate GPS non valide (latitudine). Riprova dopo aver aggiornato la posizione.';
      if p_boost_requested then
        update public.profiles set token_atcl = token_atcl + v_boost_cost where id = v_user_id;
        v_current_token_balance := v_current_token_balance + v_boost_cost;
      end if;
      return query select false, false, p_boost_requested, 'invalid_coordinates', '{}'::jsonb,
        v_current_token_balance, false, null::double precision, v_error_code, v_error_message;
      return;
    end if;

    if p_checkin_longitude < -180 or p_checkin_longitude > 180 then
      v_error_code := 'invalid_checkin_longitude';
      v_error_message := 'Coordinate GPS non valide (longitudine). Riprova dopo aver aggiornato la posizione.';
      if p_boost_requested then
        update public.profiles set token_atcl = token_atcl + v_boost_cost where id = v_user_id;
        v_current_token_balance := v_current_token_balance + v_boost_cost;
      end if;
      return query select false, false, p_boost_requested, 'invalid_coordinates', '{}'::jsonb,
        v_current_token_balance, false, null::double precision, v_error_code, v_error_message;
      return;
    end if;

    select to_regclass('public.theatres') is not null into v_theatre_table_exists;

    if coalesce(v_theatre_table_exists, false) then
      begin
        select
          case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'theatres' and column_name = 'latitude')
            then (select latitude from public.theatres where name = (select theatre from public.events where id = p_event_id) limit 1)
            when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'theatres' and column_name = 'lat')
            then (select lat from public.theatres where name = (select theatre from public.events where id = p_event_id) limit 1)
            else null end,
          case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'theatres' and column_name = 'longitude')
            then (select longitude from public.theatres where name = (select theatre from public.events where id = p_event_id) limit 1)
            when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'theatres' and column_name = 'lng')
            then (select lng from public.theatres where name = (select theatre from public.events where id = p_event_id) limit 1)
            else null end,
          case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'theatres' and column_name = 'geofence_radius_m')
            then (select geofence_radius_m from public.theatres where name = (select theatre from public.events where id = p_event_id) limit 1)
            else 100 end
          into v_theatre_lat, v_theatre_lon, v_theatre_radius_m;
      exception when others then
        v_theatre_lat := null; v_theatre_lon := null; v_theatre_radius_m := 100;
      end;

      if v_theatre_lat is not null and v_theatre_lon is not null then
        v_distance_m := 6371000 * 2 * asin(sqrt(
          power(sin(radians((p_checkin_latitude - v_theatre_lat) / 2)), 2)
          + cos(radians(v_theatre_lat)) * cos(radians(p_checkin_latitude))
          * power(sin(radians((p_checkin_longitude - v_theatre_lon) / 2)), 2)
        ));

        v_theatre_radius_m := coalesce(v_theatre_radius_m, 100);

        if v_distance_m <= v_theatre_radius_m then
          v_geofence_validated := true;
        else
          v_geofence_validated := false;
          if p_boost_requested then
            update public.profiles set token_atcl = token_atcl + v_boost_cost where id = v_user_id;
            v_current_token_balance := v_current_token_balance + v_boost_cost;
          end if;
          return query select false, false, p_boost_requested, 'outside_geofence', '{}'::jsonb,
            v_current_token_balance, v_geofence_validated, v_distance_m,
            'outside_geofence'::text, 'Sei fuori dal raggio del teatro. Avvicinati al luogo dell''evento e riprova.'::text;
          return;
        end if;
      else
        v_geofence_validated := true;
      end if;
    else
      v_geofence_validated := true;
    end if;
  end if;

  -- Calculate base rewards
  v_base_rewards := jsonb_build_object('xp', 10, 'reputation', 5, 'cachet', 2);

  v_final_rewards := case
    when p_boost_requested then jsonb_build_object(
      'xp', ((v_base_rewards->>'xp')::numeric * 1.1)::int,
      'reputation', ((v_base_rewards->>'reputation')::numeric * 1.1)::int,
      'cachet', ((v_base_rewards->>'cachet')::numeric * 1.1)::int
    )
    else v_base_rewards
  end;

  insert into public.turns (
    id, user_id, event_id, event_name, theatre, event_date, event_time,
    role_id, boost_requested, boost_applied, sync_status,
    checkin_latitude, checkin_longitude, checkin_accuracy_m,
    geofence_validated, geofence_distance_m, created_at, updated_at
  ) values (
    p_client_action_id, v_user_id, p_event_id,
    (select name from public.events where id = p_event_id),
    (select theatre from public.events where id = p_event_id),
    v_event_date, v_event_time, p_role_id,
    p_boost_requested, p_boost_requested, 'synced',
    p_checkin_latitude, p_checkin_longitude, p_checkin_accuracy_m,
    v_geofence_validated, v_distance_m, now(), now()
  );

  return query
  select
    true, p_boost_requested, p_boost_requested, null::text,
    v_final_rewards, v_current_token_balance,
    v_geofence_validated, v_distance_m,
    null::text, null::text;
end;
$$;
