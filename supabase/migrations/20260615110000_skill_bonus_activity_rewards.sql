-- Apply passive-skill bonus to activity rewards (issue #121).
--
-- The function body below is extracted VERBATIM from
-- 20260309103000_role_personalization.sql (complete_activity_with_slots),
-- changed only to multiply the granted XP/cachet by the player's passive-skill
-- multipliers. This makes course-trained skills (profiles.skills) affect the
-- reward the server actually grants for an activity, mirroring the client
-- preview (shared/config/balancing.computeSkillRewardMultipliers).
--
-- Depends on public.skill_reward_multipliers, created in
-- 20260615100000_skill_bonus_turn_rewards.sql (applied earlier by filename
-- order). Keep the SQL multiplier math and the shared TS helper in lockstep.

create or replace function public.complete_activity_with_slots(
  p_activity_id text,
  p_client_action_id uuid,
  p_score integer default null,
  p_rating text default null,
  p_attempts integer default 1,
  p_duration_ms integer default null
)
returns table (
  activity_registered boolean,
  status text,
  rejection_reason text,
  rewards_applied jsonb,
  slots_used_today integer,
  slots_total integer,
  cachet_balance_after integer,
  reputation_after integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_profile public.profiles%rowtype;
  v_activity record;
  v_existing public.activity_completions%rowtype;
  v_rewards jsonb;
  v_today date;
  v_used integer;
  v_total integer;
  v_next_xp integer;
  v_next_level integer;
  v_next_threshold integer;
  v_next_xp_total integer;
  v_next_cachet integer;
  v_next_reputation integer;
  v_role public.roles%rowtype;
  v_role_profile jsonb := '{}'::jsonb;
  v_activity_override jsonb := '{}'::jsonb;
  v_allowed_activity_ids jsonb := '[]'::jsonb;
  v_role_journey_enabled boolean := public.mobile_feature_flag_enabled('mobile.section.role_journey', false);
  v_xp_multiplier numeric := 1;
  v_cachet_multiplier numeric := 1;
  v_reputation_bonus integer := 0;
  -- passive-skill reward multipliers (#121)
  v_skill_xp_mult numeric := 1;
  v_skill_cachet_mult numeric := 1;
  v_score integer := case when p_score is null then null else greatest(0, least(100, p_score)) end;
  v_rating text := nullif(trim(coalesce(p_rating, '')), '');
  v_attempts integer := greatest(1, coalesce(p_attempts, 1));
  v_duration_ms integer := case when p_duration_ms is null then null else greatest(0, p_duration_ms) end;
  v_metadata jsonb := '{}'::jsonb;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if trim(coalesce(p_activity_id, '')) = '' then
    raise exception 'activity_id is required';
  end if;

  if p_client_action_id is null then
    raise exception 'client_action_id is required';
  end if;

  select *
    into v_existing
  from public.activity_completions
  where id = p_client_action_id
    and user_id = v_user_id;

  if found then
    select *
      into v_profile
    from public.profiles
    where id = v_user_id;

    select used_today, total_slots
      into v_used, v_total
    from public.get_activity_slots_status();

    return query
    select
      true,
      'duplicate',
      null::text,
      coalesce(v_existing.rewards, '{}'::jsonb),
      coalesce(v_used, 0),
      coalesce(v_total, 3),
      coalesce(v_profile.cachet, 0),
      coalesce(v_profile.reputation, 0);
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

  select
    a.id,
    a.xp_reward,
    a.cachet_reward
    into v_activity
  from public.activities a
  where a.id = p_activity_id;

  if not found then
    raise exception 'activity not found';
  end if;

  if v_profile.role_id is not null then
    select *
      into v_role
    from public.roles r
    where r.id = v_profile.role_id;

    if found then
      v_role_profile := coalesce(v_role.role_profile, '{}'::jsonb);
      if jsonb_typeof(v_role_profile->'allowedActivityIds') = 'array' then
        v_allowed_activity_ids := v_role_profile->'allowedActivityIds';
      end if;
      if jsonb_typeof(v_role_profile->'activityOverrides'->p_activity_id) = 'object' then
        v_activity_override := v_role_profile->'activityOverrides'->p_activity_id;
      end if;
    end if;
  end if;

  if v_role_journey_enabled
    and jsonb_array_length(v_allowed_activity_ids) > 0
    and not exists (
      select 1
      from jsonb_array_elements_text(v_allowed_activity_ids) as allowed(activity_id)
      where allowed.activity_id = v_activity.id
    )
  then
    select used_today, total_slots
      into v_used, v_total
    from public.get_activity_slots_status();

    return query
    select
      false,
      'rejected',
      'activity_not_allowed_for_role'::text,
      '{}'::jsonb,
      coalesce(v_used, 0),
      coalesce(v_total, 3),
      coalesce(v_profile.cachet, 0),
      coalesce(v_profile.reputation, 0);
    return;
  end if;

  if v_role_journey_enabled then
    v_xp_multiplier := case
      when jsonb_typeof(v_activity_override->'xpMultiplier') = 'number'
        then greatest(0::numeric, (v_activity_override->>'xpMultiplier')::numeric)
      else 1
    end;
    v_cachet_multiplier := case
      when jsonb_typeof(v_activity_override->'cachetMultiplier') = 'number'
        then greatest(0::numeric, (v_activity_override->>'cachetMultiplier')::numeric)
      else 1
    end;
    v_reputation_bonus := case
      when jsonb_typeof(v_activity_override->'reputationBonus') = 'number'
        then round((v_activity_override->>'reputationBonus')::numeric)::integer
      else 0
    end;
  end if;

  v_today := timezone('Europe/Rome', now())::date;

  select count(*)::int
    into v_used
  from public.activity_completions ac
  where ac.user_id = v_user_id
    and (ac.created_at at time zone 'Europe/Rome')::date = v_today;

  v_total := 3 + coalesce(v_profile.extra_activity_slots, 0);

  if coalesce(v_used, 0) >= v_total then
    return query
    select
      false,
      'rejected',
      'slot_limit_reached'::text,
      '{}'::jsonb,
      coalesce(v_used, 0),
      v_total,
      coalesce(v_profile.cachet, 0),
      coalesce(v_profile.reputation, 0);
    return;
  end if;

  -- Passive-skill bonus (#121): course-trained skills raise the granted reward.
  -- Mirrors shared/config/balancing.computeSkillRewardMultipliers.
  select xp_mult, cachet_mult
    into v_skill_xp_mult, v_skill_cachet_mult
  from public.skill_reward_multipliers(coalesce(v_profile.skills, '{}'::jsonb));

  v_rewards := jsonb_build_object(
    'xp', greatest(0, round(coalesce(v_activity.xp_reward, 0) * v_xp_multiplier * v_skill_xp_mult)::integer),
    'cachet', greatest(0, round(coalesce(v_activity.cachet_reward, 0) * v_cachet_multiplier * v_skill_cachet_mult)::integer),
    'reputation', greatest(0, 5 + v_reputation_bonus)
  );

  v_metadata := jsonb_strip_nulls(
    jsonb_build_object(
      'source', 'complete_activity_with_slots',
      'role_journey_enabled', v_role_journey_enabled,
      'role_id', v_profile.role_id,
      'score', v_score,
      'rating', v_rating,
      'attempts', v_attempts,
      'duration_ms', v_duration_ms
    )
  );

  insert into public.activity_completions (
    id,
    user_id,
    activity_id,
    role_id,
    rewards,
    score,
    rating,
    attempts,
    duration_ms,
    metadata
  )
  values (
    p_client_action_id,
    v_user_id,
    v_activity.id,
    v_profile.role_id,
    v_rewards,
    v_score,
    v_rating,
    v_attempts,
    v_duration_ms,
    v_metadata
  );

  v_next_xp := coalesce(v_profile.xp, 0) + coalesce((v_rewards->>'xp')::integer, 0);
  v_next_level := coalesce(v_profile.level, 1);
  v_next_threshold := greatest(1, coalesce(v_profile.xp_to_next_level, 1000));
  while v_next_xp >= v_next_threshold loop
    v_next_xp := v_next_xp - v_next_threshold;
    v_next_level := v_next_level + 1;
    v_next_threshold := 1000 + v_next_level * 250;
  end loop;

  v_next_xp_total := coalesce(v_profile.xp_total, 0) + coalesce((v_rewards->>'xp')::integer, 0);
  v_next_cachet := coalesce(v_profile.cachet, 0) + coalesce((v_rewards->>'cachet')::integer, 0);
  v_next_reputation := least(100, coalesce(v_profile.reputation, 0) + coalesce((v_rewards->>'reputation')::integer, 0));

  update public.profiles
  set
    xp = v_next_xp,
    level = v_next_level,
    xp_to_next_level = v_next_threshold,
    xp_total = v_next_xp_total,
    cachet = v_next_cachet,
    reputation = v_next_reputation,
    last_activity_at = now()
  where id = v_user_id;

  insert into public.cachet_ledger (
    user_id,
    reason,
    delta,
    balance_after,
    metadata
  )
  values (
    v_user_id,
    'earn_activity',
    coalesce((v_rewards->>'cachet')::integer, 0),
    v_next_cachet,
    jsonb_build_object(
      'activity_id', v_activity.id,
      'completion_id', p_client_action_id,
      'source', 'complete_activity_with_slots',
      'role_id', v_profile.role_id
    )
  );

  perform public.evaluate_badges_for_user(v_user_id);

  return query
  select
    true,
    'applied',
    null::text,
    v_rewards,
    coalesce(v_used, 0) + 1,
    v_total,
    v_next_cachet,
    v_next_reputation;
exception
  when unique_violation then
    select *
      into v_existing
    from public.activity_completions
    where id = p_client_action_id
      and user_id = v_user_id;

    select *
      into v_profile
    from public.profiles
    where id = v_user_id;

    select used_today, total_slots
      into v_used, v_total
    from public.get_activity_slots_status();

    return query
    select
      true,
      'duplicate',
      null::text,
      coalesce(v_existing.rewards, '{}'::jsonb),
      coalesce(v_used, 0),
      coalesce(v_total, 3),
      coalesce(v_profile.cachet, 0),
      coalesce(v_profile.reputation, 0);
end;
$$;

revoke execute on function public.complete_activity_with_slots(text, uuid, integer, text, integer, integer) from public;
grant execute on function public.complete_activity_with_slots(text, uuid, integer, text, integer, integer) to authenticated;
