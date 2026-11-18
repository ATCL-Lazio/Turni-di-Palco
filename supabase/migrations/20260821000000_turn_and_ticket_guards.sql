-- Ticket activation and turn registration guards (issue #1680)
--
-- IMPORTANT - what this migration targets
-- This migration was written against the LIVE production schema, not against the
-- schema implied by the repo migrations. Several repo migrations were never applied
-- to production (20260402_turn_registration_time_window, 20260512_fix_register_turn_rewards,
-- 20260628000000_ticket_activations_reserved_by, 20260813000000_ticket_activations_attendee_id,
-- 20260313100000_unique_turn_per_event_per_user). In production:
--   * public.turns has no checkin_*, geofence_*, sync_status or deleted_at columns;
--   * events.event_date / event_time and turns.event_date / event_time are TEXT
--     (e.g. '02 Dic 2026', '21:00');
--   * the 7-argument register_turn_with_token_boost body references turns columns that
--     do not exist, so it cannot run there. The body below replaces it with the working
--     reward/profile/ledger logic of the 4-argument overload plus the geofence logic,
--     writing only columns that exist in production.
-- The ticket_activations columns reserved_by / attendee_id are created here with
-- IF NOT EXISTS so the edge function can be deployed after this migration.
--
-- Deploy order: 1) apply this migration, 2) deploy the ticket-activation edge function.
-- (If the function is deployed first, activation by QR and manual entry would fail on the
-- missing attendee_id column; the rate limiter itself fails open if its table is missing.)
--
-- Rollback notes
--   * Policy: create policy "Users can activate an unassigned ticket" on public.ticket_activations
--       for update to authenticated using (activated_by is null) with check (auth.uid() = activated_by);
--     then grant update on public.ticket_activations to authenticated.
--   * Attempts table: drop table public.ticket_activation_attempts;
--   * Function: restore the previous body (see git history of supabase/migrations or
--     pg_get_functiondef captured before applying) and
--       grant execute on function public.register_turn_with_token_boost(text, text, uuid, boolean) to authenticated;
--       grant execute on function public.register_turn_with_token_boost(text, text, uuid, boolean,
--         double precision, double precision, double precision) to anon;

-- ---------------------------------------------------------------------------
-- 1. ticket_activations: columns, direct-write lockdown
-- ---------------------------------------------------------------------------

alter table public.ticket_activations
  add column if not exists reserved_by uuid references auth.users(id) on delete set null;
alter table public.ticket_activations
  add column if not exists attendee_id uuid references auth.users(id) on delete set null;

create index if not exists ticket_activations_reserved_by_idx
  on public.ticket_activations(reserved_by) where reserved_by is not null;
create index if not exists ticket_activations_attendee_id_idx
  on public.ticket_activations(attendee_id) where attendee_id is not null;

-- Activation happens only through the ticket-activation edge function (service role).
drop policy if exists "Users can activate an unassigned ticket" on public.ticket_activations;

revoke all on public.ticket_activations from anon;
revoke insert, update, delete, truncate on public.ticket_activations from authenticated;

-- ---------------------------------------------------------------------------
-- 2. Attempts table for the activation rate limiter (service role only)
-- ---------------------------------------------------------------------------

create table if not exists public.ticket_activation_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ip_hash text,
  action text not null,
  created_at timestamptz not null default now()
);

create index if not exists ticket_activation_attempts_user_idx
  on public.ticket_activation_attempts (user_id, created_at desc);
create index if not exists ticket_activation_attempts_ip_idx
  on public.ticket_activation_attempts (ip_hash, created_at desc) where ip_hash is not null;
create index if not exists ticket_activation_attempts_created_idx
  on public.ticket_activation_attempts (created_at);

alter table public.ticket_activation_attempts enable row level security;
revoke all on public.ticket_activation_attempts from anon, authenticated;
grant all on public.ticket_activation_attempts to service_role;

-- ---------------------------------------------------------------------------
-- 3. register_turn_with_token_boost
-- ---------------------------------------------------------------------------

-- Rewards are computed server-side from the event (base_rewards, focus_role).
-- Guards added here:
--   * geofence is validated against public.theatres when the check-in carries
--     coordinates and the mobile.action.turn_geofence flag is enabled;
--   * check-ins for events that start more than 12 hours from now are rejected
--     (event_not_started); skipped when the event date/time cannot be parsed;
--   * one turn per event per user.
-- Rejections raise an exception so that the whole transaction (including the boost
-- token spend) is rolled back and the client maps the message token to a localized error.
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
  c_future_window interval := interval '12 hours';
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
  -- time window
  v_date_match text[];
  v_time_match text[];
  v_month integer;
  v_event_start timestamptz;
  -- geofence
  v_geofence_enabled boolean := true;
  v_theatre_lat double precision;
  v_theatre_lon double precision;
  v_theatre_radius_m double precision;
  v_distance_m double precision := null;
  v_geofence_ok boolean := true;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'user_not_authenticated';
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

  -- Idempotency: same client action id returns the stored result.
  select *
    into v_existing_turn
  from public.turns
  where id = p_client_action_id
    and user_id = v_user_id;

  if found then
    select token_atcl into v_token_after from public.profiles where id = v_user_id;
    return query
    select
      false,
      coalesce(v_existing_turn.boost_applied, false),
      coalesce(v_existing_turn.boost_requested, false),
      v_existing_turn.boost_rejection_reason,
      coalesce(v_existing_turn.rewards, '{}'::jsonb),
      coalesce(v_token_after, 0),
      false,
      null::double precision,
      'already_registered'::text,
      'Hai già registrato un turno per questo evento.'::text;
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

  perform 1 from public.roles where id = p_role_id;
  if not found then
    raise exception 'invalid role_id';
  end if;

  select e.id, e.name, e.theatre, e.event_date, e.event_time, e.base_rewards, e.focus_role
    into v_event
  from public.events e
  where e.id = p_event_id;

  if not found then
    raise exception 'event_not_found';
  end if;

  -- One turn per event per user (the profile row lock above serialises concurrent calls).
  if exists (
    select 1 from public.turns t where t.user_id = v_user_id and t.event_id = v_event.id
  ) then
    select token_atcl into v_token_after from public.profiles where id = v_user_id;
    return query
    select
      false, false, p_boost_requested, 'already_registered'::text,
      '{}'::jsonb, coalesce(v_token_after, 0),
      false, null::double precision, 'already_registered'::text,
      'Hai già registrato un turno per questo evento.'::text;
    return;
  end if;

  -- Upper time bound: events are stored as text ('DD Mon YYYY' with Italian month
  -- abbreviations, 'HH:MM'). If the value cannot be parsed the check is skipped.
  begin
    v_date_match := regexp_match(
      trim(coalesce(v_event.event_date, '')), '^(\d{1,2})\s+([[:alpha:]]{3})[[:alpha:]]*\.?\s+(\d{4})$');
    if v_date_match is not null then
      v_month := array_position(
        array['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'],
        lower(v_date_match[2]));
      if v_month is not null then
        v_time_match := regexp_match(trim(coalesce(v_event.event_time, '')), '^(\d{1,2}):(\d{2})');
        v_event_start := make_timestamptz(
          v_date_match[3]::integer, v_month, v_date_match[1]::integer,
          coalesce(v_time_match[1]::integer, 0), coalesce(v_time_match[2]::integer, 0), 0,
          'Europe/Rome');
        if v_event_start > now() + c_future_window then
          raise exception 'event_not_started';
        end if;
      end if;
    end if;
  exception
    when invalid_datetime_format or datetime_field_overflow or invalid_parameter_value
      or numeric_value_out_of_range then
      null; -- unparseable date: skip the check
  end;

  -- Geofence (only when the flag is on and the check-in carries coordinates).
  begin
    select enabled into v_geofence_enabled
    from public.mobile_feature_flags
    where key = 'mobile.action.turn_geofence'
    limit 1;
  exception when undefined_table then
    v_geofence_enabled := true;
  end;
  v_geofence_enabled := coalesce(v_geofence_enabled, true);

  if v_geofence_enabled and p_checkin_latitude is not null and p_checkin_longitude is not null then
    if p_checkin_latitude::text = 'NaN' or p_checkin_latitude < -90 or p_checkin_latitude > 90 then
      raise exception 'invalid_checkin_latitude';
    end if;
    if p_checkin_longitude::text = 'NaN' or p_checkin_longitude < -180 or p_checkin_longitude > 180 then
      raise exception 'invalid_checkin_longitude';
    end if;

    select t.latitude, t.longitude, t.geofence_radius_m
      into v_theatre_lat, v_theatre_lon, v_theatre_radius_m
    from public.theatres t
    where t.name = v_event.theatre
    limit 1;

    if v_theatre_lat is not null and v_theatre_lon is not null then
      v_distance_m := 6371000 * 2 * asin(least(1, sqrt(
        power(sin(radians((p_checkin_latitude - v_theatre_lat) / 2)), 2)
        + cos(radians(v_theatre_lat)) * cos(radians(p_checkin_latitude))
          * power(sin(radians((p_checkin_longitude - v_theatre_lon) / 2)), 2)
      )));
      if v_distance_m > coalesce(v_theatre_radius_m, 100) then
        raise exception 'outside_geofence';
      end if;
    else
      v_geofence_ok := false; -- theatre coordinates not configured: nothing to validate against
    end if;
  else
    v_geofence_ok := false; -- no coordinates (or geofence disabled): not validated
  end if;

  -- Rewards (unchanged from the working 4-argument implementation).
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

      insert into public.token_ledger (user_id, reason, delta, balance_after, metadata)
      values (
        v_user_id, 'spend_boost', -1, v_token_working,
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

  v_rewards := jsonb_build_object('xp', v_final_xp, 'reputation', v_final_reputation, 'cachet', v_final_cachet);

  insert into public.turns (
    id, user_id, event_id, event_name, theatre, event_date, event_time, role_id,
    rewards, boost_requested, boost_applied, boost_rejection_reason
  )
  values (
    p_client_action_id, v_user_id, v_event.id, v_event.name, v_event.theatre,
    v_event.event_date, v_event.event_time, p_role_id,
    v_rewards, p_boost_requested, v_boost_applied, v_boost_rejection_reason
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

  insert into public.token_ledger (user_id, reason, delta, balance_after, metadata)
  values (
    v_user_id, 'earn_turn', v_turn_token_reward, v_token_after,
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
    v_boost_applied,
    p_boost_requested,
    v_boost_rejection_reason,
    v_rewards,
    v_token_after,
    v_geofence_ok,
    v_distance_m,
    null::text,
    null::text;
exception
  when unique_violation then
    select * into v_existing_turn
    from public.turns
    where id = p_client_action_id and user_id = v_user_id;
    if found then
      select token_atcl into v_token_after from public.profiles where id = v_user_id;
      return query
      select
        false,
        coalesce(v_existing_turn.boost_applied, false),
        coalesce(v_existing_turn.boost_requested, false),
        v_existing_turn.boost_rejection_reason,
        coalesce(v_existing_turn.rewards, '{}'::jsonb),
        coalesce(v_token_after, 0),
        false,
        null::double precision,
        'already_registered'::text,
        'Hai già registrato un turno per questo evento.'::text;
      return;
    end if;
    raise;
end;
$$;

revoke execute on function public.register_turn_with_token_boost(
  text, text, uuid, boolean, double precision, double precision, double precision) from public, anon;
grant execute on function public.register_turn_with_token_boost(
  text, text, uuid, boolean, double precision, double precision, double precision) to authenticated;

-- The legacy 4-argument overload has no guards at all: leaving it executable would
-- bypass every check above. No current client calls it (both call sites pass the
-- check-in arguments). It is revoked, not dropped, so it can be restored if needed.
revoke execute on function public.register_turn_with_token_boost(text, text, uuid, boolean)
  from public, anon, authenticated;
