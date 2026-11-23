-- AI support guards for the /api/ai/* serverless endpoints (Maxwell).
--
-- Serverless instances do not share memory, so the previous in-memory rate limit
-- and the in-memory chat session map were reset on every cold start and were
-- not shared between concurrent instances. This migration moves that state to
-- Postgres:
--   * ai_rate_limits    fixed-window counters per user and scope (chat)
--   * ai_chat_sessions  app chat id -> Claude agent session id, per user
--   * ai_support_issues ledger of GitHub issues opened through Maxwell, used for
--                       per-user and global daily caps and for deduplication
--
-- The endpoints call the RPCs below with the caller's own Supabase JWT, so no
-- service role key is needed on Vercel. Every RPC keys its rows on auth.uid():
-- a user calling them directly can only touch their own counters and rows.
-- Caps for issues are fixed here (not passed by the caller) so they cannot be
-- raised from the client.
--
-- Additive and non-destructive. Tables have RLS enabled and no policies: they
-- are reachable only through the security definer functions.
--
-- Rollback notes
--   drop function if exists public.ai_rate_limit_hit(text, integer);
--   drop function if exists public.ai_chat_session_get(text);
--   drop function if exists public.ai_chat_session_put(text, text);
--   drop function if exists public.ai_issue_reserve(text);
--   drop function if exists public.ai_issue_finish(bigint, integer, text);
--   drop table if exists public.ai_rate_limits, public.ai_chat_sessions, public.ai_support_issues;
--   (the endpoints then fall back to the per-instance in-memory limit for chat
--   and refuse to open issues until the migration is back)

-- ---------------------------------------------------------------------------
-- Rate limit counters
-- ---------------------------------------------------------------------------

create table if not exists public.ai_rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  scope text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (user_id, scope, window_start)
);

alter table public.ai_rate_limits enable row level security;
revoke all on public.ai_rate_limits from anon, authenticated;

-- Counts one hit in the current fixed window and returns the hits so far.
-- The endpoint compares the result with its own limit.
create or replace function public.ai_rate_limit_hit(p_scope text, p_window_seconds integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_window timestamptz;
  v_hits integer;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_scope not in ('chat_minute', 'chat_day') then
    raise exception 'invalid scope' using errcode = '22023';
  end if;
  if p_window_seconds is null or p_window_seconds < 10 or p_window_seconds > 86400 then
    raise exception 'invalid window' using errcode = '22023';
  end if;

  v_window := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.ai_rate_limits as r (user_id, scope, window_start, hits)
  values (v_uid, p_scope, v_window, 1)
  on conflict (user_id, scope, window_start)
  do update set hits = r.hits + 1
  returning r.hits into v_hits;

  -- Housekeeping: drop this user's old windows for the scope.
  delete from public.ai_rate_limits
  where user_id = v_uid
    and scope = p_scope
    and window_start < now() - interval '2 days';

  return v_hits;
end;
$$;

-- ---------------------------------------------------------------------------
-- Chat session map
-- ---------------------------------------------------------------------------

create table if not exists public.ai_chat_sessions (
  user_id uuid not null references auth.users (id) on delete cascade,
  client_session_id text not null
    check (char_length(client_session_id) between 1 and 128),
  agent_session_id text not null
    check (char_length(agent_session_id) between 1 and 128),
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  primary key (user_id, client_session_id)
);

alter table public.ai_chat_sessions enable row level security;
revoke all on public.ai_chat_sessions from anon, authenticated;

create or replace function public.ai_chat_session_get(p_client_session_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_agent text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  update public.ai_chat_sessions
  set last_used_at = now()
  where user_id = v_uid
    and client_session_id = p_client_session_id
    and last_used_at > now() - interval '30 days'
  returning agent_session_id into v_agent;

  return v_agent;
end;
$$;

-- Insert only: an existing mapping is never overwritten, so a session cannot be
-- repointed once created.
create or replace function public.ai_chat_session_put(
  p_client_session_id text,
  p_agent_session_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  delete from public.ai_chat_sessions
  where user_id = v_uid
    and last_used_at < now() - interval '30 days';

  insert into public.ai_chat_sessions (user_id, client_session_id, agent_session_id)
  values (v_uid, p_client_session_id, p_agent_session_id)
  on conflict (user_id, client_session_id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Support issues ledger
-- ---------------------------------------------------------------------------

create table if not exists public.ai_support_issues (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending'
    check (status in ('pending', 'created', 'failed')),
  issue_number integer,
  issue_url text,
  created_at timestamptz not null default now()
);

create index if not exists ai_support_issues_fingerprint_idx
  on public.ai_support_issues (fingerprint, created_at desc);
create index if not exists ai_support_issues_created_idx
  on public.ai_support_issues (created_at desc);
create index if not exists ai_support_issues_user_idx
  on public.ai_support_issues (user_id, created_at desc);

alter table public.ai_support_issues enable row level security;
revoke all on public.ai_support_issues from anon, authenticated;

-- Reserves a slot for a new issue, or explains why not.
-- Returns jsonb: { status: 'reserved', id } | { status: 'duplicate', number, url }
--              | { status: 'user_limit' } | { status: 'global_limit' }
-- Limits: 3 issues per user per 24h, 20 issues overall per 24h, and the same
-- fingerprint (normalised title) is not opened twice within 7 days.
create or replace function public.ai_issue_reserve(p_fingerprint text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_user_daily_max constant integer := 3;
  c_global_daily_max constant integer := 20;
  c_dedupe_window constant interval := interval '7 days';
  v_uid uuid := auth.uid();
  v_existing public.ai_support_issues%rowtype;
  v_count integer;
  v_id bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid fingerprint' using errcode = '22023';
  end if;

  -- Serialise reservations so concurrent requests cannot both pass the caps.
  perform pg_advisory_xact_lock(hashtext('public.ai_support_issues'));

  select * into v_existing
  from public.ai_support_issues
  where fingerprint = p_fingerprint
    and status in ('pending', 'created')
    and created_at > now() - c_dedupe_window
  order by created_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'status', 'duplicate',
      'number', v_existing.issue_number,
      'url', v_existing.issue_url
    );
  end if;

  select count(*) into v_count
  from public.ai_support_issues
  where user_id = v_uid
    and status <> 'failed'
    and created_at > now() - interval '24 hours';
  if v_count >= c_user_daily_max then
    return jsonb_build_object('status', 'user_limit');
  end if;

  select count(*) into v_count
  from public.ai_support_issues
  where status <> 'failed'
    and created_at > now() - interval '24 hours';
  if v_count >= c_global_daily_max then
    return jsonb_build_object('status', 'global_limit');
  end if;

  insert into public.ai_support_issues (user_id, fingerprint)
  values (v_uid, p_fingerprint)
  returning id into v_id;

  return jsonb_build_object('status', 'reserved', 'id', v_id);
end;
$$;

-- Closes a reservation: with a number and url it is marked created, without
-- them it is marked failed (and stops counting towards the caps).
create or replace function public.ai_issue_finish(
  p_id bigint,
  p_issue_number integer,
  p_issue_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_issue_url is not null and p_issue_url !~ '^https://github\.com/' then
    raise exception 'invalid issue url' using errcode = '22023';
  end if;

  update public.ai_support_issues
  set status = case when p_issue_number is null then 'failed' else 'created' end,
      issue_number = p_issue_number,
      issue_url = p_issue_url
  where id = p_id
    and user_id = v_uid
    and status = 'pending';
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: only signed-in users, through the RPCs.
-- ---------------------------------------------------------------------------

revoke all on function public.ai_rate_limit_hit(text, integer) from public, anon;
revoke all on function public.ai_chat_session_get(text) from public, anon;
revoke all on function public.ai_chat_session_put(text, text) from public, anon;
revoke all on function public.ai_issue_reserve(text) from public, anon;
revoke all on function public.ai_issue_finish(bigint, integer, text) from public, anon;

grant execute on function public.ai_rate_limit_hit(text, integer) to authenticated;
grant execute on function public.ai_chat_session_get(text) to authenticated;
grant execute on function public.ai_chat_session_put(text, text) to authenticated;
grant execute on function public.ai_issue_reserve(text) to authenticated;
grant execute on function public.ai_issue_finish(bigint, integer, text) to authenticated;
