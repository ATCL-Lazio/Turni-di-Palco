alter table public.roles
  add column if not exists role_profile jsonb not null default '{}'::jsonb;

alter table public.activity_completions
  add column if not exists role_id text references public.roles(id) on update cascade on delete set null,
  add column if not exists score integer,
  add column if not exists rating text,
  add column if not exists attempts integer not null default 1,
  add column if not exists duration_ms integer,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.activity_completions ac
set role_id = p.role_id
from public.profiles p
where ac.user_id = p.id
  and ac.role_id is null;

alter table public.activity_completions
  drop constraint if exists activity_completions_score_check;

alter table public.activity_completions
  add constraint activity_completions_score_check
  check (score is null or (score >= 0 and score <= 100));

alter table public.activity_completions
  drop constraint if exists activity_completions_attempts_check;

alter table public.activity_completions
  add constraint activity_completions_attempts_check
  check (attempts >= 1);

alter table public.activity_completions
  drop constraint if exists activity_completions_duration_ms_check;

alter table public.activity_completions
  add constraint activity_completions_duration_ms_check
  check (duration_ms is null or duration_ms >= 0);

create index if not exists activity_completions_role_id_idx
  on public.activity_completions(role_id);

create index if not exists activity_completions_user_role_activity_idx
  on public.activity_completions(user_id, role_id, activity_id);

create index if not exists activity_completions_user_activity_score_idx
  on public.activity_completions(user_id, activity_id, score);

alter table public.badges
  add column if not exists role_id text references public.roles(id) on update cascade on delete set null,
  add column if not exists activity_id text references public.activities(id) on update cascade on delete set null,
  add column if not exists min_score integer,
  add column if not exists completion_threshold integer not null default 1;

alter table public.badges
  drop constraint if exists badges_min_score_check;

alter table public.badges
  add constraint badges_min_score_check
  check (min_score is null or (min_score >= 0 and min_score <= 100));

alter table public.badges
  drop constraint if exists badges_completion_threshold_check;

alter table public.badges
  add constraint badges_completion_threshold_check
  check (completion_threshold >= 1);

create or replace function public.mobile_feature_flag_enabled(
  p_key text,
  p_default boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select mff.enabled
      from public.mobile_feature_flags mff
      where mff.key = p_key
    ),
    p_default
  );
$$;

revoke execute on function public.mobile_feature_flag_enabled(text, boolean) from public;
grant execute on function public.mobile_feature_flag_enabled(text, boolean) to authenticated;

insert into public.mobile_feature_flags (key, enabled, label, description, category)
values (
  'mobile.section.role_journey',
  true,
  'Sezione Percorso Ruolo',
  'Abilita il percorso ruolo con onboarding, ordinamento attivita e card dedicate nell''app mobile.',
  'section'
)
on conflict (key) do update
set
  enabled = excluded.enabled,
  label = excluded.label,
  description = excluded.description,
  category = excluded.category;

insert into public.roles (id, name, focus, stats, role_profile)
values (
  'dramaturg',
  'Dramaturg',
  'Analisi del testo e ritmo di scena',
  '{"presence":70,"precision":82,"leadership":78,"creativity":92}'::jsonb,
  $json$
  {
    "allowedActivityIds": ["copione", "recitazione", "ritardo"],
    "activityOrder": ["copione", "recitazione", "ritardo"],
    "homeMessage": "Oggi il focus e rifinire ritmo, sottotesto e continuita di scena.",
    "journey": {
      "eyebrow": "Percorso ruolo",
      "headline": "Costruisci il battito della scena prima dell ingresso in palco.",
      "summary": "Parti da Revisione copione, consolida il sottotesto e sblocca i primi badge di ruolo.",
      "recommendedActivityId": "copione",
      "starterBadgeLabels": ["Primo briefing drammaturgico", "Occhio sul testo"],
      "objectives": [
        "Avvia Revisione copione e completa il primo briefing",
        "Mantieni almeno 80/100 in tre sessioni sul testo",
        "Usa Recitazione per validare ritmo e ingressi"
      ],
      "homeCtaLabel": "Apri percorso dramaturg"
    },
    "activityOverrides": {
      "copione": {
        "xpMultiplier": 1.2,
        "cachetMultiplier": 1.1,
        "reputationBonus": 4,
        "highlightLabel": "Missione dramaturg",
        "homeNote": "Perfetta per sbloccare i badge dedicati al testo."
      },
      "recitazione": {
        "xpMultiplier": 1.08,
        "reputationBonus": 2,
        "highlightLabel": "Analisi sottotesto"
      }
    }
  }
  $json$::jsonb
)
on conflict (id) do update
set
  name = excluded.name,
  focus = excluded.focus,
  stats = excluded.stats,
  role_profile = excluded.role_profile;

insert into public.activities (id, title, description, duration, xp_reward, cachet_reward, difficulty)
values (
  'copione',
  'Revisione copione',
  'Analizza le transizioni del testo e blocca i passaggi critici nel punto giusto.',
  '5 min',
  58,
  24,
  'Medio'
)
on conflict (id) do update
set
  title = excluded.title,
  description = excluded.description,
  duration = excluded.duration,
  xp_reward = excluded.xp_reward,
  cachet_reward = excluded.cachet_reward,
  difficulty = excluded.difficulty;

-- TODO: promuovere queste metriche in una tabella analytics dedicata se servono trend o breakdown piu dettagliati.
create or replace view public.my_minigame_stats as
select
  auth.uid() as user_id,
  ac.activity_id,
  ac.role_id,
  count(*)::int as completions,
  sum(coalesce(ac.attempts, 1))::int as attempts,
  max(ac.score) as best_score,
  round(avg(ac.duration_ms))::int as avg_duration_ms
from public.activity_completions ac
where ac.user_id = auth.uid()
group by ac.activity_id, ac.role_id;

grant select on public.my_minigame_stats to authenticated;

create or replace function public.evaluate_badges_for_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_turns integer;
  v_turns_this_month integer;
  v_unique_theatres integer;
  v_role_id text;
  v_role_journey_enabled boolean;
begin
  if p_user_id is null then
    return;
  end if;

  select count(*)::int
    into v_total_turns
  from public.turns
  where user_id = p_user_id;

  select count(*)::int
    into v_turns_this_month
  from public.turns
  where user_id = p_user_id
    and created_at >= date_trunc('month', now())
    and created_at < (date_trunc('month', now()) + interval '1 month');

  select count(distinct theatre)::int
    into v_unique_theatres
  from public.turns
  where user_id = p_user_id
    and theatre is not null
    and theatre <> '';

  insert into public.user_badges (user_id, badge_id)
  select p_user_id, b.id
  from public.badges b
  where b.metric = 'total_turns'
    and b.threshold is not null
    and v_total_turns >= b.threshold
  on conflict do nothing;

  insert into public.user_badges (user_id, badge_id)
  select p_user_id, b.id
  from public.badges b
  where b.metric = 'turns_this_month'
    and b.threshold is not null
    and v_turns_this_month >= b.threshold
  on conflict do nothing;

  insert into public.user_badges (user_id, badge_id)
  select p_user_id, b.id
  from public.badges b
  where b.metric = 'unique_theatres'
    and b.threshold is not null
    and v_unique_theatres >= b.threshold
  on conflict do nothing;

  select p.role_id
    into v_role_id
  from public.profiles p
  where p.id = p_user_id;

  v_role_journey_enabled := public.mobile_feature_flag_enabled('mobile.section.role_journey', false);
  if not v_role_journey_enabled or trim(coalesce(v_role_id, '')) = '' then
    return;
  end if;

  insert into public.user_badges (user_id, badge_id)
  select p_user_id, b.id
  from public.badges b
  where b.role_id = v_role_id
    and coalesce((
      select count(*)::int
      from public.activity_completions ac
      where ac.user_id = p_user_id
        and ac.role_id = v_role_id
        and (b.activity_id is null or ac.activity_id = b.activity_id)
        and (b.min_score is null or coalesce(ac.score, 0) >= b.min_score)
    ), 0) >= coalesce(b.completion_threshold, 1)
  on conflict do nothing;
end;
$$;

drop function if exists public.complete_activity_with_slots(text, uuid);

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

  v_rewards := jsonb_build_object(
    'xp', greatest(0, round(coalesce(v_activity.xp_reward, 0) * v_xp_multiplier)::integer),
    'cachet', greatest(0, round(coalesce(v_activity.cachet_reward, 0) * v_cachet_multiplier)::integer),
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

insert into public.badges (
  id,
  title,
  description,
  icon,
  metric,
  threshold,
  is_hidden,
  role_id,
  activity_id,
  min_score,
  completion_threshold
)
values
  (
    'role_dramaturg_first_brief',
    'Primo briefing drammaturgico',
    'Completa Revisione copione con almeno 60/100.',
    'BookOpen',
    'manual',
    null,
    false,
    'dramaturg',
    'copione',
    60,
    1
  ),
  (
    'role_dramaturg_text_eye',
    'Occhio sul testo',
    'Chiudi 3 revisioni copione con almeno 80/100.',
    'BookOpen',
    'manual',
    null,
    true,
    'dramaturg',
    'copione',
    80,
    3
  )
on conflict (id) do update
set
  title = excluded.title,
  description = excluded.description,
  icon = excluded.icon,
  metric = excluded.metric,
  threshold = excluded.threshold,
  is_hidden = excluded.is_hidden,
  role_id = excluded.role_id,
  activity_id = excluded.activity_id,
  min_score = excluded.min_score,
  completion_threshold = excluded.completion_threshold;

do $$
declare
  v_user_id uuid;
begin
  for v_user_id in
    select distinct p.id
    from public.profiles p
    where p.role_id = 'dramaturg'
  loop
    perform public.evaluate_badges_for_user(v_user_id);
  end loop;
end;
$$;
