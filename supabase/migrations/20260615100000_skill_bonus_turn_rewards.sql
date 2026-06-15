-- Apply passive-skill bonus to turn rewards (issue #121).
--
-- Builds on 20260512_fix_register_turn_rewards.sql: the function body is
-- IDENTICAL except for the passive-skill multiplier applied in the reward
-- section, so completing a course (which raises profiles.skills) is now
-- reflected in the XP/cachet a turn actually grants — satisfying the #121
-- acceptance criterion "bonus riflesso in almeno un calcolo".
--
-- The multiplier math is centralized in public.skill_reward_multipliers and
-- MUST stay in lockstep with the shared client helper
-- shared/config/balancing.ts (computeSkillRewardMultipliers):
--   xp     = presence(+0.4%/pt, cap +20%) * creativity(+0.3%/pt, cap +20%)
--   cachet = precision(+0.3%/pt, cap +20%) * leadership(+0.2%/pt, cap +10%)
-- Each factor is 1 at or below the baseline of 50, so skills never penalize.

-- Centralized, immutable skill → reward multiplier helper (#121).
create or replace function public.skill_reward_multipliers(p_skills jsonb)
returns table (xp_mult numeric, cachet_mult numeric)
language sql
immutable
as $$
  select
    (1 + least(0.20, 0.004 * greatest(0, coalesce((p_skills->>'presence')::numeric, 0) - 50)))
      * (1 + least(0.20, 0.003 * greatest(0, coalesce((p_skills->>'creativity')::numeric, 0) - 50))),
    (1 + least(0.20, 0.003 * greatest(0, coalesce((p_skills->>'precision')::numeric, 0) - 50)))
      * (1 + least(0.10, 0.002 * greatest(0, coalesce((p_skills->>'leadership')::numeric, 0) - 50)));
$$;

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
set search_path = public
as $$
declare
  v_user_id uuid;
  v_profile public.profiles%rowtype;
  v_existing_turn_id uuid;
  v_event record;
  v_event_date date;
  v_event_time time;
  v_event_datetime timestamptz;
  -- reward calculation
  v_bonus integer;
  v_base_xp integer;
  v_base_reputation integer;
  v_base_cachet integer;
  v_final_xp integer;
  v_final_reputation integer;
  v_final_cachet integer;
  v_rewards jsonb;
  -- boost
  v_boost_applied boolean := false;
  v_boost_rejection_reason text := null;
  v_boost_cost integer := 1;
  v_turn_token_reward integer := 1;
  v_token_working integer;
  v_token_after integer;
  -- profile progression
  v_next_xp integer;
  v_next_level integer;
  v_next_threshold integer;
  v_next_xp_total integer;
  v_next_xp_field integer;
  v_next_reputation integer;
  v_next_cachet integer;
  -- geofence
  v_theatre_table_exists boolean;
  v_geofence_enabled boolean;
  v_mobile_feature_flags_table_exists boolean;
  v_theatre_lat double precision;
  v_theatre_lon double precision;
  v_theatre_radius_m double precision;
  v_distance_m double precision;
  v_geofence_ok boolean := true;
  -- passive-skill reward multipliers (#121)
  v_skill_xp_mult numeric := 1;
  v_skill_cachet_mult numeric := 1;
begin
  -- ── 1. Auth ──────────────────────────────────────────────────────────────
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'user_not_authenticated';
  end if;

  -- ── 2. Input validation ───────────────────────────────────────────────────
  if trim(coalesce(p_event_id, '')) = '' then
    raise exception 'event_id is required';
  end if;

  if trim(coalesce(p_role_id, '')) = '' then
    raise exception 'role_id is required';
  end if;

  if p_client_action_id is null then
    raise exception 'client_action_id is required';
  end if;

  -- ── 3. Event lookup ───────────────────────────────────────────────────────
  select e.id, e.name, e.theatre, e.event_date, e.event_time,
         e.base_rewards, e.focus_role
    into v_event
  from public.events e
  where e.id = p_event_id;

  if not found then
    raise exception 'event_not_found';
  end if;

  -- ── 4. Time-window validation (24 h after event end) ─────────────────────
  v_event_datetime := (v_event.event_date::timestamp
    + coalesce(v_event.event_time, time '23:59:59')) at time zone 'UTC';

  if v_event_datetime < (now() - interval '24 hours') then
    raise exception 'registration_window_expired';
  end if;

  -- ── 5. Profile lock ───────────────────────────────────────────────────────
  select * into v_profile
  from public.profiles
  where id = v_user_id
  for update;

  if not found then
    raise exception 'profile not found';
  end if;

  -- ── 6. Role validation ────────────────────────────────────────────────────
  perform 1 from public.roles where id = p_role_id;
  if not found then
    raise exception 'invalid role_id';
  end if;

  -- ── 7. Duplicate detection (idempotency: same client_action_id) ──────────
  select id into v_existing_turn_id
  from public.turns
  where id = p_client_action_id and user_id = v_user_id;

  if found then
    select token_atcl into v_token_after from public.profiles where id = v_user_id;
    return query
      select false, false, p_boost_requested, 'already_registered'::text,
             '{}'::jsonb, coalesce(v_token_after, 0),
             false, null::double precision, 'already_registered'::text,
             'Hai già registrato un turno per questo evento.'::text;
    return;
  end if;

  -- ── 8. Duplicate detection (business: one turn per event per user) ────────
  select id into v_existing_turn_id
  from public.turns
  where user_id = v_user_id
    and event_id = p_event_id
    and deleted_at is null
  limit 1;

  if found then
    select token_atcl into v_token_after from public.profiles where id = v_user_id;
    return query
      select false, false, p_boost_requested, 'already_registered'::text,
             '{}'::jsonb, coalesce(v_token_after, 0),
             false, null::double precision, 'already_registered'::text,
             'Hai già registrato un turno per questo evento.'::text;
    return;
  end if;

  -- ── 9. Token boost pre-deduction ─────────────────────────────────────────
  v_token_working := coalesce(v_profile.token_atcl, 0);

  if p_boost_requested then
    if v_token_working >= v_boost_cost then
      v_boost_applied := true;
      v_token_working := v_token_working - v_boost_cost;
      update public.profiles
        set token_atcl = token_atcl - v_boost_cost
        where id = v_user_id;
    else
      v_boost_applied := false;
      v_boost_rejection_reason := 'insufficient_token_balance';
      select token_atcl into v_token_after from public.profiles where id = v_user_id;
      return query
        select false, false, p_boost_requested, v_boost_rejection_reason,
               '{}'::jsonb, coalesce(v_token_after, 0),
               false, null::double precision, 'insufficient_tokens'::text,
               'Token ATCL insufficienti per richiedere il boost.'::text;
      return;
    end if;
  end if;

  -- ── 10. Geofence (optional: only when coords provided and flag enabled) ───
  v_geofence_ok := true;
  v_distance_m := null;

  select exists(select 1 from information_schema.tables
                where table_schema = 'public' and table_name = 'mobile_feature_flags')
    into v_mobile_feature_flags_table_exists;

  if coalesce(v_mobile_feature_flags_table_exists, false) then
    select enabled into v_geofence_enabled
    from public.mobile_feature_flags
    where key = 'mobile.action.turn_geofence'
    limit 1;
  end if;
  v_geofence_enabled := coalesce(v_geofence_enabled, true);

  if v_geofence_enabled
     and p_checkin_latitude is not null
     and p_checkin_longitude is not null
  then
    if p_checkin_latitude < -90 or p_checkin_latitude > 90 then
      if v_boost_applied then
        update public.profiles set token_atcl = token_atcl + v_boost_cost where id = v_user_id;
        v_token_working := v_token_working + v_boost_cost;
      end if;
      return query
        select false, false, p_boost_requested, 'invalid_coordinates'::text,
               '{}'::jsonb, v_token_working,
               false, null::double precision, 'invalid_checkin_latitude'::text,
               'Coordinate GPS non valide (latitudine).'::text;
      return;
    end if;

    if p_checkin_longitude < -180 or p_checkin_longitude > 180 then
      if v_boost_applied then
        update public.profiles set token_atcl = token_atcl + v_boost_cost where id = v_user_id;
        v_token_working := v_token_working + v_boost_cost;
      end if;
      return query
        select false, false, p_boost_requested, 'invalid_coordinates'::text,
               '{}'::jsonb, v_token_working,
               false, null::double precision, 'invalid_checkin_longitude'::text,
               'Coordinate GPS non valide (longitudine).'::text;
      return;
    end if;

    select to_regclass('public.theatres') is not null into v_theatre_table_exists;

    if coalesce(v_theatre_table_exists, false) then
      begin
        select
          case when exists(select 1 from information_schema.columns
                           where table_schema='public' and table_name='theatres'
                             and column_name='latitude')
               then (select latitude from public.theatres
                     where name = v_event.theatre limit 1)
               when exists(select 1 from information_schema.columns
                           where table_schema='public' and table_name='theatres'
                             and column_name='lat')
               then (select lat from public.theatres
                     where name = v_event.theatre limit 1)
               else null end,
          case when exists(select 1 from information_schema.columns
                           where table_schema='public' and table_name='theatres'
                             and column_name='longitude')
               then (select longitude from public.theatres
                     where name = v_event.theatre limit 1)
               when exists(select 1 from information_schema.columns
                           where table_schema='public' and table_name='theatres'
                             and column_name='lng')
               then (select lng from public.theatres
                     where name = v_event.theatre limit 1)
               else null end,
          case when exists(select 1 from information_schema.columns
                           where table_schema='public' and table_name='theatres'
                             and column_name='geofence_radius_m')
               then (select geofence_radius_m from public.theatres
                     where name = v_event.theatre limit 1)
               else 200 end
          into v_theatre_lat, v_theatre_lon, v_theatre_radius_m;
      exception when others then
        v_theatre_lat := null; v_theatre_lon := null; v_theatre_radius_m := 200;
      end;

      if v_theatre_lat is not null and v_theatre_lon is not null then
        v_distance_m := 6371000 * 2 * asin(sqrt(
          power(sin(radians((p_checkin_latitude - v_theatre_lat) / 2)), 2)
          + cos(radians(v_theatre_lat)) * cos(radians(p_checkin_latitude))
          * power(sin(radians((p_checkin_longitude - v_theatre_lon) / 2)), 2)
        ));
        v_theatre_radius_m := coalesce(v_theatre_radius_m, 200);

        if v_distance_m > v_theatre_radius_m then
          v_geofence_ok := false;
          if v_boost_applied then
            update public.profiles set token_atcl = token_atcl + v_boost_cost where id = v_user_id;
            v_token_working := v_token_working + v_boost_cost;
          end if;
          return query
            select false, false, p_boost_requested, 'outside_geofence'::text,
                   '{}'::jsonb, v_token_working,
                   false, v_distance_m, 'outside_geofence'::text,
                   'Sei fuori dal raggio del teatro. Avvicinati al luogo dell''evento e riprova.'::text;
          return;
        end if;
      end if;
    end if;
  end if;

  -- ── 11. Reward calculation ────────────────────────────────────────────────
  v_bonus := case when v_event.focus_role = p_role_id then 15 else 0 end;
  v_base_xp         := coalesce((v_event.base_rewards->>'xp')::integer, 0)         + v_bonus;
  v_base_cachet     := coalesce((v_event.base_rewards->>'cachet')::integer, 0)     + round(v_bonus / 2.0)::integer;
  v_base_reputation := coalesce((v_event.base_rewards->>'reputation')::integer, 0) + round(v_bonus / 3.0)::integer;

  v_final_xp         := v_base_xp;
  v_final_cachet     := v_base_cachet;
  v_final_reputation := v_base_reputation;

  if v_boost_applied then
    v_final_xp     := ceil(v_base_xp     * 1.10)::integer;
    v_final_cachet := ceil(v_base_cachet * 1.10)::integer;
  end if;

  -- Passive-skill bonus (#121): course-trained skills raise the granted reward.
  -- Mirrors shared/config/balancing.computeSkillRewardMultipliers.
  select xp_mult, cachet_mult
    into v_skill_xp_mult, v_skill_cachet_mult
  from public.skill_reward_multipliers(coalesce(v_profile.skills, '{}'::jsonb));

  v_final_xp     := round(v_final_xp     * v_skill_xp_mult)::integer;
  v_final_cachet := round(v_final_cachet * v_skill_cachet_mult)::integer;

  v_rewards := jsonb_build_object(
    'xp',         v_final_xp,
    'reputation', v_final_reputation,
    'cachet',     v_final_cachet
  );

  -- ── 12. Insert turn ───────────────────────────────────────────────────────
  insert into public.turns (
    id, user_id, event_id, event_name, theatre,
    event_date, event_time, role_id, rewards,
    boost_requested, boost_applied, boost_rejection_reason, sync_status,
    checkin_latitude, checkin_longitude, checkin_accuracy_m,
    geofence_validated, geofence_distance_m,
    created_at, updated_at
  ) values (
    p_client_action_id, v_user_id, v_event.id, v_event.name, v_event.theatre,
    v_event.event_date, v_event.event_time, p_role_id, v_rewards,
    p_boost_requested, v_boost_applied, v_boost_rejection_reason, 'synced',
    p_checkin_latitude, p_checkin_longitude, p_checkin_accuracy_m,
    v_geofence_ok, v_distance_m,
    now(), now()
  );

  -- ── 13. Update profile ────────────────────────────────────────────────────
  v_next_xp        := coalesce(v_profile.xp, 0) + v_final_xp;
  v_next_level     := coalesce(v_profile.level, 1);
  v_next_threshold := greatest(1, coalesce(v_profile.xp_to_next_level, 1000));

  while v_next_xp >= v_next_threshold loop
    v_next_xp        := v_next_xp - v_next_threshold;
    v_next_level     := v_next_level + 1;
    v_next_threshold := 1000 + v_next_level * 250;
  end loop;

  v_next_xp_total    := coalesce(v_profile.xp_total, 0)    + v_final_xp;
  v_next_xp_field    := coalesce(v_profile.xp_field, 0)    + v_final_xp;
  v_next_reputation  := least(100, coalesce(v_profile.reputation, 0) + v_final_reputation);
  v_next_cachet      := coalesce(v_profile.cachet, 0)       + v_final_cachet;
  v_token_after      := v_token_working + v_turn_token_reward;

  update public.profiles
  set
    level            = v_next_level,
    xp               = v_next_xp,
    xp_to_next_level = v_next_threshold,
    xp_total         = v_next_xp_total,
    xp_field         = v_next_xp_field,
    reputation       = v_next_reputation,
    cachet           = v_next_cachet,
    token_atcl       = v_token_after,
    last_activity_at = now()
  where id = v_user_id;

  -- ── 14. Token ledger ─────────────────────────────────────────────────────
  -- spend_boost is written here (not at pre-deduction) so aborted registrations
  -- (geofence failure, invalid coords) leave no stray ledger entries to reverse.
  if v_boost_applied then
    insert into public.token_ledger (user_id, reason, delta, balance_after, metadata)
      values (v_user_id, 'spend_boost', -v_boost_cost, v_token_working,
              jsonb_build_object('event_id', p_event_id,
                                 'client_action_id', p_client_action_id));
  end if;

  insert into public.token_ledger (user_id, reason, delta, balance_after, metadata)
    values (v_user_id, 'earn_turn', v_turn_token_reward, v_token_after,
            jsonb_build_object(
              'event_id',        v_event.id,
              'client_action_id', p_client_action_id,
              'boost_requested', p_boost_requested,
              'boost_applied',   v_boost_applied,
              'rewards',         v_rewards
            ));

  -- ── 15. Return ────────────────────────────────────────────────────────────
  return query
    select true, v_boost_applied, p_boost_requested, v_boost_rejection_reason,
           v_rewards, v_token_after,
           v_geofence_ok, v_distance_m,
           null::text, null::text;

exception
  when unique_violation then
    select token_atcl into v_token_after from public.profiles where id = v_user_id;
    return query
      select false, false, p_boost_requested, 'already_registered'::text,
             '{}'::jsonb, coalesce(v_token_after, 0),
             false, null::double precision, 'already_registered'::text,
             'Hai già registrato un turno per questo evento.'::text;
end;
$$;

revoke execute on function public.register_turn_with_token_boost(text, text, uuid, boolean, double precision, double precision, double precision) from public;
grant execute on function public.register_turn_with_token_boost(text, text, uuid, boolean, double precision, double precision, double precision) to authenticated;
