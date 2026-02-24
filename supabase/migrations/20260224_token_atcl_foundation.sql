-- Issue #117: token_atcl foundation + server-authoritative turn registration

alter table public.profiles
  add column if not exists token_atcl integer not null default 0;

alter table public.profiles
  drop constraint if exists profiles_token_atcl_non_negative;

alter table public.profiles
  add constraint profiles_token_atcl_non_negative
  check (token_atcl >= 0);

alter table public.turns
  add column if not exists boost_requested boolean not null default false;

alter table public.turns
  add column if not exists boost_applied boolean not null default false;

alter table public.turns
  add column if not exists boost_rejection_reason text;

create table if not exists public.token_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (
    reason in (
      'earn_turn',
      'spend_boost',
      'redeem_reservation',
      'redeem_settlement',
      'redeem_reversal',
      'manual_adjust'
    )
  ),
  delta integer not null,
  balance_after integer not null check (balance_after >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists token_ledger_user_created_idx
  on public.token_ledger(user_id, created_at desc);

create table if not exists public.token_reward_catalog (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  token_cost integer not null check (token_cost > 0),
  active boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_token_reward_catalog_updated_at on public.token_reward_catalog;
create trigger set_token_reward_catalog_updated_at
before update on public.token_reward_catalog
for each row execute function public.set_updated_at();

create table if not exists public.token_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_id uuid not null references public.token_reward_catalog(id) on update cascade on delete restrict,
  status text not null default 'requested' check (
    status in ('requested', 'reserved', 'settled', 'reversed', 'rejected')
  ),
  token_cost integer not null check (token_cost > 0),
  ledger_reservation_id uuid references public.token_ledger(id) on delete set null,
  ledger_settlement_id uuid references public.token_ledger(id) on delete set null,
  ledger_reversal_id uuid references public.token_ledger(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists token_redemptions_user_created_idx
  on public.token_redemptions(user_id, created_at desc);

drop trigger if exists set_token_redemptions_updated_at on public.token_redemptions;
create trigger set_token_redemptions_updated_at
before update on public.token_redemptions
for each row execute function public.set_updated_at();

alter table public.token_ledger enable row level security;
alter table public.token_ledger force row level security;
alter table public.token_reward_catalog enable row level security;
alter table public.token_reward_catalog force row level security;
alter table public.token_redemptions enable row level security;
alter table public.token_redemptions force row level security;

drop policy if exists "token ledger select own" on public.token_ledger;
create policy "token ledger select own"
on public.token_ledger
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "token catalog read active" on public.token_reward_catalog;
create policy "token catalog read active"
on public.token_reward_catalog
for select
to authenticated
using (active = true);

drop policy if exists "token redemptions select own" on public.token_redemptions;
create policy "token redemptions select own"
on public.token_redemptions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "token redemptions insert own" on public.token_redemptions;
create policy "token redemptions insert own"
on public.token_redemptions
for insert
to authenticated
with check (auth.uid() = user_id);

-- Guard rail: prevent direct client writes to token_atcl.
revoke insert (token_atcl) on public.profiles from authenticated;
revoke update (token_atcl) on public.profiles from authenticated;

create or replace function public.register_turn_with_token_boost(
  p_event_id text,
  p_role_id text,
  p_client_action_id uuid,
  p_boost_requested boolean default false
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

revoke execute on function public.register_turn_with_token_boost(text, text, uuid, boolean) from public;
grant execute on function public.register_turn_with_token_boost(text, text, uuid, boolean) to authenticated;

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

  delete from public.token_redemptions where user_id = v_user_id;
  delete from public.token_ledger where user_id = v_user_id;
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
    cachet = 0,
    token_atcl = 0
  where id = v_user_id;
end;
$$;

revoke execute on function public.reset_my_progress() from public;
grant execute on function public.reset_my_progress() to authenticated;

insert into public.token_reward_catalog (code, title, description, token_cost, active, metadata)
values
  (
    'discount_voucher_placeholder',
    'Buono sconto (placeholder)',
    'Placeholder per futuri riscatti reali ATCL.',
    5,
    false,
    jsonb_build_object('kind', 'discount')
  ),
  (
    'special_event_ticket_placeholder',
    'Biglietto evento speciale (placeholder)',
    'Placeholder per futuri biglietti premio.',
    12,
    false,
    jsonb_build_object('kind', 'special_event_ticket')
  )
on conflict (code) do update
set
  title = excluded.title,
  description = excluded.description,
  token_cost = excluded.token_cost,
  active = excluded.active,
  metadata = excluded.metadata;
