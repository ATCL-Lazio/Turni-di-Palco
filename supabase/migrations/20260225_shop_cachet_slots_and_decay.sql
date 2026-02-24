-- Shop cachet + activity slots + severe reputation decay (ATCL + theatre)

alter table public.profiles
  add column if not exists extra_activity_slots integer not null default 0;

alter table public.profiles
  add column if not exists last_reputation_decay_at date;

alter table public.profiles
  drop constraint if exists profiles_extra_activity_slots_non_negative;

alter table public.profiles
  add constraint profiles_extra_activity_slots_non_negative
  check (extra_activity_slots >= 0);

create table if not exists public.cachet_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (
    reason in (
      'earn_turn',
      'earn_activity',
      'spend_shop',
      'manual_adjust'
    )
  ),
  delta integer not null,
  balance_after integer not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists cachet_ledger_user_created_idx
  on public.cachet_ledger(user_id, created_at desc);

create table if not exists public.shop_catalog (
  code text primary key,
  title text not null,
  description text,
  category text not null check (category in ('slot', 'rep_atcl', 'rep_theatre')),
  currency text not null default 'cachet' check (currency = 'cachet'),
  cost_cachet integer not null check (cost_cachet > 0),
  effect_value integer not null check (effect_value > 0),
  max_purchases_per_user integer check (max_purchases_per_user is null or max_purchases_per_user > 0),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_shop_catalog_updated_at on public.shop_catalog;
create trigger set_shop_catalog_updated_at
before update on public.shop_catalog
for each row execute function public.set_updated_at();

create table if not exists public.shop_purchases (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  item_code text not null references public.shop_catalog(code) on update cascade on delete restrict,
  target_theatre text,
  status text not null check (status in ('applied', 'rejected')),
  rejection_reason text,
  cost_cachet integer not null check (cost_cachet >= 0),
  effect jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shop_purchases_user_created_idx
  on public.shop_purchases(user_id, created_at desc);

create index if not exists shop_purchases_item_idx
  on public.shop_purchases(item_code);

drop trigger if exists set_shop_purchases_updated_at on public.shop_purchases;
create trigger set_shop_purchases_updated_at
before update on public.shop_purchases
for each row execute function public.set_updated_at();

create table if not exists public.theatre_reputation_adjustments (
  user_id uuid not null references auth.users(id) on delete cascade,
  theatre text not null,
  adjustment integer not null default 0,
  last_activity_at timestamptz not null default now(),
  last_decay_at date,
  updated_at timestamptz not null default now(),
  primary key (user_id, theatre)
);

create index if not exists theatre_reputation_adjustments_user_idx
  on public.theatre_reputation_adjustments(user_id);

drop trigger if exists set_theatre_reputation_adjustments_updated_at on public.theatre_reputation_adjustments;
create trigger set_theatre_reputation_adjustments_updated_at
before update on public.theatre_reputation_adjustments
for each row execute function public.set_updated_at();

alter table public.cachet_ledger enable row level security;
alter table public.cachet_ledger force row level security;
alter table public.shop_catalog enable row level security;
alter table public.shop_catalog force row level security;
alter table public.shop_purchases enable row level security;
alter table public.shop_purchases force row level security;
alter table public.theatre_reputation_adjustments enable row level security;
alter table public.theatre_reputation_adjustments force row level security;

drop policy if exists "cachet ledger select own" on public.cachet_ledger;
create policy "cachet ledger select own"
on public.cachet_ledger
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "shop catalog read active" on public.shop_catalog;
create policy "shop catalog read active"
on public.shop_catalog
for select
to authenticated
using (active = true);

drop policy if exists "shop purchases select own" on public.shop_purchases;
create policy "shop purchases select own"
on public.shop_purchases
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "theatre reputation adjustments select own" on public.theatre_reputation_adjustments;
create policy "theatre reputation adjustments select own"
on public.theatre_reputation_adjustments
for select
to authenticated
using ((select auth.uid()) = user_id);

-- Guard rails: economy fields are server-authoritative.
revoke update (xp) on public.profiles from authenticated;
revoke update (xp_to_next_level) on public.profiles from authenticated;
revoke update (xp_total) on public.profiles from authenticated;
revoke update (xp_field) on public.profiles from authenticated;
revoke update (reputation) on public.profiles from authenticated;
revoke update (cachet) on public.profiles from authenticated;
revoke update (token_atcl) on public.profiles from authenticated;
revoke update (extra_activity_slots) on public.profiles from authenticated;
revoke update (last_activity_at) on public.profiles from authenticated;
revoke update (last_reputation_decay_at) on public.profiles from authenticated;

create or replace function public.track_turn_theatre_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null or trim(coalesce(new.theatre, '')) = '' then
    return new;
  end if;

  insert into public.theatre_reputation_adjustments (
    user_id,
    theatre,
    adjustment,
    last_activity_at
  )
  values (
    new.user_id,
    trim(new.theatre),
    0,
    coalesce(new.created_at, now())
  )
  on conflict (user_id, theatre)
  do update
  set last_activity_at = greatest(
    public.theatre_reputation_adjustments.last_activity_at,
    excluded.last_activity_at
  );

  insert into public.cachet_ledger (
    user_id,
    reason,
    delta,
    balance_after,
    metadata
  )
  select
    new.user_id,
    'earn_turn',
    coalesce((new.rewards->>'cachet')::integer, 0),
    coalesce(p.cachet, 0),
    jsonb_build_object(
      'turn_id', new.id,
      'event_id', new.event_id,
      'source', 'turn_insert_trigger'
    )
  from public.profiles p
  where p.id = new.user_id;

  return new;
end;
$$;

drop trigger if exists track_turn_theatre_activity_trigger on public.turns;
create trigger track_turn_theatre_activity_trigger
after insert on public.turns
for each row execute function public.track_turn_theatre_activity();

insert into public.theatre_reputation_adjustments (
  user_id,
  theatre,
  adjustment,
  last_activity_at
)
select
  t.user_id,
  trim(t.theatre) as theatre,
  0 as adjustment,
  max(t.created_at) as last_activity_at
from public.turns t
where trim(coalesce(t.theatre, '')) <> ''
group by t.user_id, trim(t.theatre)
on conflict (user_id, theatre)
do update
set last_activity_at = greatest(
  public.theatre_reputation_adjustments.last_activity_at,
  excluded.last_activity_at
);

create or replace view public.my_theatre_reputation as
with base as (
  select
    t.theatre,
    sum(coalesce((t.rewards->>'reputation')::int, 0))::int as base_reputation,
    count(*)::int as total_turns
  from public.turns t
  where t.user_id = auth.uid()
    and trim(coalesce(t.theatre, '')) <> ''
  group by t.theatre
),
adjustments as (
  select
    tra.theatre,
    tra.adjustment
  from public.theatre_reputation_adjustments tra
  where tra.user_id = auth.uid()
)
select
  coalesce(b.theatre, a.theatre) as theatre,
  least(100, greatest(0, coalesce(b.base_reputation, 0) + coalesce(a.adjustment, 0)))::int as reputation,
  coalesce(b.total_turns, 0)::int as total_turns
from base b
full outer join adjustments a
  on a.theatre = b.theatre
where trim(coalesce(b.theatre, a.theatre, '')) <> '';

grant select on public.my_theatre_reputation to authenticated;

create or replace function public.get_activity_slots_status()
returns table (
  used_today integer,
  total_slots integer,
  remaining_slots integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_today date;
  v_used integer;
  v_extra integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  v_today := timezone('Europe/Rome', now())::date;

  select coalesce(p.extra_activity_slots, 0)
    into v_extra
  from public.profiles p
  where p.id = v_user_id;

  if v_extra is null then
    v_extra := 0;
  end if;

  select count(*)::int
    into v_used
  from public.activity_completions ac
  where ac.user_id = v_user_id
    and (ac.created_at at time zone 'Europe/Rome')::date = v_today;

  return query
  select
    coalesce(v_used, 0),
    3 + v_extra,
    greatest(0, (3 + v_extra) - coalesce(v_used, 0));
end;
$$;

revoke execute on function public.get_activity_slots_status() from public;
grant execute on function public.get_activity_slots_status() to authenticated;

create or replace function public.complete_activity_with_slots(
  p_activity_id text,
  p_client_action_id uuid
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
    'xp', coalesce(v_activity.xp_reward, 0),
    'cachet', coalesce(v_activity.cachet_reward, 0),
    'reputation', 5
  );

  insert into public.activity_completions (
    id,
    user_id,
    activity_id,
    rewards
  )
  values (
    p_client_action_id,
    v_user_id,
    v_activity.id,
    v_rewards
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
      'source', 'complete_activity_with_slots'
    )
  );

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

revoke execute on function public.complete_activity_with_slots(text, uuid) from public;
grant execute on function public.complete_activity_with_slots(text, uuid) to authenticated;

create or replace function public.purchase_shop_item(
  p_item_code text,
  p_client_action_id uuid,
  p_target_theatre text default null
)
returns table (
  purchase_applied boolean,
  status text,
  rejection_reason text,
  cachet_balance_after integer,
  profile_reputation_after integer,
  extra_slots_after integer,
  theatre text,
  theatre_reputation_after integer,
  effect jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_profile public.profiles%rowtype;
  v_item public.shop_catalog%rowtype;
  v_existing public.shop_purchases%rowtype;
  v_target_theatre text;
  v_applied_count integer;
  v_new_cachet integer;
  v_new_reputation integer;
  v_new_slots integer;
  v_theatre_adjustment integer;
  v_theatre_rep integer;
  v_effect jsonb;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_client_action_id is null then
    raise exception 'client_action_id is required';
  end if;

  if trim(coalesce(p_item_code, '')) = '' then
    raise exception 'item_code is required';
  end if;

  v_target_theatre := nullif(trim(coalesce(p_target_theatre, '')), '');

  select *
    into v_existing
  from public.shop_purchases
  where id = p_client_action_id
    and user_id = v_user_id;

  if found then
    select *
      into v_profile
    from public.profiles
    where id = v_user_id;

    return query
    select
      v_existing.status = 'applied',
      v_existing.status,
      v_existing.rejection_reason,
      coalesce(v_profile.cachet, 0),
      coalesce(v_profile.reputation, 0),
      coalesce(v_profile.extra_activity_slots, 0),
      coalesce(v_existing.target_theatre, v_target_theatre),
      null::integer,
      coalesce(v_existing.effect, '{}'::jsonb);
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

  select *
    into v_item
  from public.shop_catalog
  where code = p_item_code
    and active = true
    and currency = 'cachet';

  if not found then
    return query
    select
      false,
      'rejected',
      'item_not_available',
      coalesce(v_profile.cachet, 0),
      coalesce(v_profile.reputation, 0),
      coalesce(v_profile.extra_activity_slots, 0),
      v_target_theatre,
      null::integer,
      '{}'::jsonb;
    return;
  end if;

  if v_item.category = 'rep_theatre' and v_target_theatre is null then
    insert into public.shop_purchases (
      id,
      user_id,
      item_code,
      target_theatre,
      status,
      rejection_reason,
      cost_cachet,
      effect
    )
    values (
      p_client_action_id,
      v_user_id,
      v_item.code,
      null,
      'rejected',
      'target_theatre_required',
      v_item.cost_cachet,
      '{}'::jsonb
    );

    return query
    select
      false,
      'rejected',
      'target_theatre_required',
      coalesce(v_profile.cachet, 0),
      coalesce(v_profile.reputation, 0),
      coalesce(v_profile.extra_activity_slots, 0),
      null::text,
      null::integer,
      '{}'::jsonb;
    return;
  end if;

  if v_item.category = 'rep_theatre' then
    perform 1
    from public.turns t
    where t.user_id = v_user_id
      and trim(coalesce(t.theatre, '')) = v_target_theatre;

    if not found then
      insert into public.shop_purchases (
        id,
        user_id,
        item_code,
        target_theatre,
        status,
        rejection_reason,
        cost_cachet,
        effect
      )
      values (
        p_client_action_id,
        v_user_id,
        v_item.code,
        v_target_theatre,
        'rejected',
        'theatre_not_eligible',
        v_item.cost_cachet,
        '{}'::jsonb
      );

      return query
      select
        false,
        'rejected',
        'theatre_not_eligible',
        coalesce(v_profile.cachet, 0),
        coalesce(v_profile.reputation, 0),
        coalesce(v_profile.extra_activity_slots, 0),
        v_target_theatre,
        null::integer,
        '{}'::jsonb;
      return;
    end if;
  end if;

  if v_item.max_purchases_per_user is not null then
    select count(*)::int
      into v_applied_count
    from public.shop_purchases sp
    where sp.user_id = v_user_id
      and sp.item_code = v_item.code
      and sp.status = 'applied';

    if coalesce(v_applied_count, 0) >= v_item.max_purchases_per_user then
      insert into public.shop_purchases (
        id,
        user_id,
        item_code,
        target_theatre,
        status,
        rejection_reason,
        cost_cachet,
        effect
      )
      values (
        p_client_action_id,
        v_user_id,
        v_item.code,
        v_target_theatre,
        'rejected',
        'max_purchase_reached',
        v_item.cost_cachet,
        '{}'::jsonb
      );

      return query
      select
        false,
        'rejected',
        'max_purchase_reached',
        coalesce(v_profile.cachet, 0),
        coalesce(v_profile.reputation, 0),
        coalesce(v_profile.extra_activity_slots, 0),
        v_target_theatre,
        null::integer,
        '{}'::jsonb;
      return;
    end if;
  end if;

  if coalesce(v_profile.cachet, 0) < v_item.cost_cachet then
    insert into public.shop_purchases (
      id,
      user_id,
      item_code,
      target_theatre,
      status,
      rejection_reason,
      cost_cachet,
      effect
    )
    values (
      p_client_action_id,
      v_user_id,
      v_item.code,
      v_target_theatre,
      'rejected',
      'insufficient_cachet',
      v_item.cost_cachet,
      '{}'::jsonb
    );

    return query
    select
      false,
      'rejected',
      'insufficient_cachet',
      coalesce(v_profile.cachet, 0),
      coalesce(v_profile.reputation, 0),
      coalesce(v_profile.extra_activity_slots, 0),
      v_target_theatre,
      null::integer,
      '{}'::jsonb;
    return;
  end if;

  v_new_cachet := coalesce(v_profile.cachet, 0) - v_item.cost_cachet;
  v_new_reputation := coalesce(v_profile.reputation, 0);
  v_new_slots := coalesce(v_profile.extra_activity_slots, 0);
  v_effect := '{}'::jsonb;

  if v_item.category = 'slot' then
    v_new_slots := v_new_slots + v_item.effect_value;
    update public.profiles
    set
      cachet = v_new_cachet,
      extra_activity_slots = v_new_slots
    where id = v_user_id;

    v_effect := jsonb_build_object('extra_activity_slots', v_item.effect_value);
  elsif v_item.category = 'rep_atcl' then
    v_new_reputation := least(100, v_new_reputation + v_item.effect_value);
    update public.profiles
    set
      cachet = v_new_cachet,
      reputation = v_new_reputation
    where id = v_user_id;

    v_effect := jsonb_build_object('reputation_atcl', v_item.effect_value);
  else
    update public.profiles
    set cachet = v_new_cachet
    where id = v_user_id;

    insert into public.theatre_reputation_adjustments (
      user_id,
      theatre,
      adjustment,
      last_activity_at
    )
    values (
      v_user_id,
      v_target_theatre,
      v_item.effect_value,
      now()
    )
    on conflict (user_id, theatre)
    do update
    set adjustment = public.theatre_reputation_adjustments.adjustment + excluded.adjustment
    returning adjustment
    into v_theatre_adjustment;

    select least(100, greatest(
      0,
      coalesce(sum((t.rewards->>'reputation')::integer), 0) + coalesce(v_theatre_adjustment, 0)
    ))::integer
      into v_theatre_rep
    from public.turns t
    where t.user_id = v_user_id
      and trim(coalesce(t.theatre, '')) = v_target_theatre;

    v_effect := jsonb_build_object(
      'reputation_theatre', v_item.effect_value,
      'theatre', v_target_theatre
    );
  end if;

  insert into public.cachet_ledger (
    user_id,
    reason,
    delta,
    balance_after,
    metadata
  )
  values (
    v_user_id,
    'spend_shop',
    -v_item.cost_cachet,
    v_new_cachet,
    jsonb_build_object(
      'item_code', v_item.code,
      'purchase_id', p_client_action_id,
      'target_theatre', v_target_theatre,
      'category', v_item.category
    )
  );

  insert into public.shop_purchases (
    id,
    user_id,
    item_code,
    target_theatre,
    status,
    rejection_reason,
    cost_cachet,
    effect
  )
  values (
    p_client_action_id,
    v_user_id,
    v_item.code,
    v_target_theatre,
    'applied',
    null,
    v_item.cost_cachet,
    v_effect
  );

  return query
  select
    true,
    'applied',
    null::text,
    v_new_cachet,
    v_new_reputation,
    v_new_slots,
    v_target_theatre,
    v_theatre_rep,
    v_effect;
exception
  when unique_violation then
    select *
      into v_existing
    from public.shop_purchases
    where id = p_client_action_id
      and user_id = v_user_id;

    select *
      into v_profile
    from public.profiles
    where id = v_user_id;

    return query
    select
      coalesce(v_existing.status = 'applied', false),
      coalesce(v_existing.status, 'rejected'),
      v_existing.rejection_reason,
      coalesce(v_profile.cachet, 0),
      coalesce(v_profile.reputation, 0),
      coalesce(v_profile.extra_activity_slots, 0),
      coalesce(v_existing.target_theatre, v_target_theatre),
      null::integer,
      coalesce(v_existing.effect, '{}'::jsonb);
end;
$$;

revoke execute on function public.purchase_shop_item(text, uuid, text) from public;
grant execute on function public.purchase_shop_item(text, uuid, text) to authenticated;

create or replace function public.apply_daily_reputation_decay(
  p_today date default current_date
)
returns table (
  decayed_profiles integer,
  decayed_theatres integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profiles_count integer := 0;
  v_theatres_count integer := 0;
begin
  with due_profiles as (
    select
      p.id,
      p.reputation,
      (p.last_activity_at at time zone 'Europe/Rome')::date as last_active_date,
      greatest(
        0,
        (p_today - (p.last_activity_at at time zone 'Europe/Rome')::date) - 3
      ) as target_days,
      greatest(
        0,
        (coalesce(p.last_reputation_decay_at, (p.last_activity_at at time zone 'Europe/Rome')::date + 3)
          - (p.last_activity_at at time zone 'Europe/Rome')::date) - 3
      ) as already_days
    from public.profiles p
    where p.last_activity_at is not null
  ),
  profile_updates as (
    update public.profiles p
    set
      reputation = greatest(0, p.reputation - ((dp.target_days - dp.already_days) * 5)),
      last_reputation_decay_at = p_today
    from due_profiles dp
    where dp.id = p.id
      and (dp.target_days - dp.already_days) > 0
    returning p.id
  )
  select count(*)::int into v_profiles_count from profile_updates;

  with due_theatres as (
    select
      tra.user_id,
      tra.theatre,
      tra.adjustment,
      (tra.last_activity_at at time zone 'Europe/Rome')::date as last_active_date,
      greatest(
        0,
        (p_today - (tra.last_activity_at at time zone 'Europe/Rome')::date) - 3
      ) as target_days,
      greatest(
        0,
        (coalesce(tra.last_decay_at, (tra.last_activity_at at time zone 'Europe/Rome')::date + 3)
          - (tra.last_activity_at at time zone 'Europe/Rome')::date) - 3
      ) as already_days
    from public.theatre_reputation_adjustments tra
  ),
  theatre_updates as (
    update public.theatre_reputation_adjustments tra
    set
      adjustment = tra.adjustment - ((dt.target_days - dt.already_days) * 5),
      last_decay_at = p_today
    from due_theatres dt
    where dt.user_id = tra.user_id
      and dt.theatre = tra.theatre
      and (dt.target_days - dt.already_days) > 0
    returning tra.user_id, tra.theatre
  )
  select count(*)::int into v_theatres_count from theatre_updates;

  return query select v_profiles_count, v_theatres_count;
end;
$$;

revoke execute on function public.apply_daily_reputation_decay(date) from public;
grant execute on function public.apply_daily_reputation_decay(date) to service_role;

do $$
declare
  v_job_id bigint;
begin
  if to_regclass('cron.job') is null then
    return;
  end if;

  for v_job_id in
    select jobid from cron.job where jobname = 'tdp_reputation_decay_daily'
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'tdp_reputation_decay_daily',
    '5 3 * * *',
    'select public.apply_daily_reputation_decay();'
  );
exception
  when undefined_function then
    null;
end;
$$;

insert into public.shop_catalog (
  code,
  title,
  description,
  category,
  currency,
  cost_cachet,
  effect_value,
  max_purchases_per_user,
  active,
  metadata
)
values
  (
    'extra_slot_permanent',
    'Slot attività extra (permanente)',
    'Aumenta in modo permanente il numero massimo di attività giornaliere.',
    'slot',
    'cachet',
    4000,
    1,
    2,
    true,
    jsonb_build_object('base_slots', 3)
  ),
  (
    'rep_pack_atcl',
    'Pack reputazione ATCL',
    'Incrementa la reputazione ATCL globale.',
    'rep_atcl',
    'cachet',
    1200,
    10,
    null,
    true,
    '{}'::jsonb
  ),
  (
    'rep_pack_theatre',
    'Pack reputazione Teatro',
    'Incrementa la reputazione in un teatro già giocato.',
    'rep_theatre',
    'cachet',
    1800,
    15,
    null,
    true,
    '{}'::jsonb
  )
on conflict (code) do update
set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  currency = excluded.currency,
  cost_cachet = excluded.cost_cachet,
  effect_value = excluded.effect_value,
  max_purchases_per_user = excluded.max_purchases_per_user,
  active = excluded.active,
  metadata = excluded.metadata;
